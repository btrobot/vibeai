import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { orders, payments, refunds } from '../../../db/schema/payments';
import { users } from '../../../db/schema';
import { subscriptions, creditUsage } from '../../../db/schema/billing';
import { eq, and, desc, count, gte, sql } from 'drizzle-orm';
import type { OrderResponse, OrderStatus } from '../../order/types/order.types';

// ===== Refund Types =====

export interface RefundResponse {
  id: string;
  userId: string;
  orderId: string | null;
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  providerRefundId: string | null;
  refundedBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface RefundDetailResponse {
  id: string;
  userId: string;
  orderId: string | null;
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  providerRefundId: string | null;
  createdAt: string;
  completedAt: string | null;
  order: OrderResponse | null;
  payment: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    provider: string;
    providerPaymentId: string | null;
    createdAt: string;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  refundedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface RefundStatsResponse {
  totalRefunds: number;
  totalRefundedAmount: number;
  statsByStatus: Record<string, { count: number; totalAmount: number }>;
  averageRefundAmount: number;
}
import type { AdminRefundOrderDto } from '../dto/admin-orders.dto';

@Injectable()
export class AdminOrderService {
  private readonly logger = new Logger(AdminOrderService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Get order statistics
   */
  async getOrderStats(range: string = '30d'): Promise<{
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    totalRevenue: number;
  }> {
    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30); // Default to 30 days

    // Get total orders in date range
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(orders)
      .where(gte(orders.createdAt, startDate));

    const totalOrders = Number(totalResult?.count || 0);

    // Get paid orders
    const [paidResult] = await this.db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.status, 'paid'));

    const paidOrders = Number(paidResult?.count || 0);

    // Get pending orders
    const [pendingResult] = await this.db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.status, 'pending'));

    const pendingOrders = Number(pendingResult?.count || 0);

    // Calculate total revenue from completed/paid orders
    const [revenueResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${orders.amount} AS NUMERIC)), 0)` })
      .from(orders)
      .where(sql`${orders.status} IN ('paid', 'completed')`);

    const totalRevenue = Number(revenueResult?.total || 0);

    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      totalRevenue,
    };
  }

  /**
   * List all orders (admin can see all)
   */
  async listOrders(query: {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
    userId?: string;
    orderNumber?: string;
  }): Promise<{ items: OrderResponse[]; total: number }> {
    const { page = 1, pageSize = 20, status, type, userId, orderNumber } = query;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status) conditions.push(eq(orders.status, status));
    if (type) conditions.push(eq(orders.type, type));
    if (userId) conditions.push(eq(orders.userId, userId));
    if (orderNumber) conditions.push(eq(orders.orderNumber, orderNumber));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(orders)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    // Get paginated results
    const items = await this.db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((o) => this.toResponse(o)),
      total,
    };
  }

  /**
   * Get order detail with payment information
   */
  async getOrderDetail(orderId: string): Promise<OrderResponse & { payment?: any }> {
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const response = this.toResponse(order) as OrderResponse & { payment?: any };

    // Get payment information if linked
    if (order.paymentId) {
      const [payment] = await this.db
        .select()
        .from(payments)
        .where(eq(payments.id, order.paymentId))
        .limit(1);

      if (payment) {
        response.payment = {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          provider: payment.provider,
          providerPaymentId: payment.providerPaymentId,
          createdAt: payment.createdAt,
        };
      }
    }

    return response;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<OrderResponse> {
    const [order] = await this.db
      .update(orders)
      .set({
        status,
        updatedAt: new Date(),
        // @ts-ignore - conditional updates
        completedAt: status === 'completed' ? new Date() : null,
        // @ts-ignore
        cancelledAt: status === 'cancelled' ? new Date() : null,
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.logger.log(`Order ${orderId} status updated to ${status}`);

    return this.toResponse(order);
  }

  /**
   * Refund order with Stripe integration and credit recovery
   */
  async refundOrder(
    orderId: string,
    dto: AdminRefundOrderDto,
    adminUserId: string,
  ): Promise<{ refundId: string; amount: number; creditsReclaimed?: number }> {
    // Get order
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if order is paid
    if (order.status !== 'paid' && order.status !== 'completed') {
      throw new BadRequestException('Order can only be refunded if paid or completed');
    }

    // Get payment
    if (!order.paymentId) {
      throw new BadRequestException('Order has no linked payment');
    }

    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, order.paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if payment is completed
    if (payment.status !== 'completed') {
      throw new BadRequestException('Payment is not completed');
    }

    // Calculate refund amount
    const refundAmount = dto.amount ? dto.amount.toString() : payment.amount;

    // Check if Stripe is configured
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    let stripeRefundId: string | null = null;

    if (stripeKey && payment.provider === 'stripe' && payment.providerPaymentId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeKey);

        // Create Stripe refund
        const stripeRefund = await stripe.refunds.create({
          payment_intent: payment.providerPaymentId,
          amount: Math.round(Number(refundAmount) * 100), // Convert to cents
          reason: 'requested_by_customer',
          metadata: {
            orderId: order.id,
            refundReason: dto.reason,
          },
        });

        stripeRefundId = stripeRefund.id;
        this.logger.log(`Stripe refund created: ${stripeRefund.id}`);
      } catch (error) {
        this.logger.error(`Stripe refund failed: ${(error as Error).message}`);
        throw new BadRequestException(`Stripe refund failed: ${(error as Error).message}`);
      }
    }

    // Create refund record
    const [refund] = await this.db
      .insert(refunds)
      .values({
        userId: order.userId,
        paymentId: payment.id,
        orderId: order.id,
        amount: refundAmount,
        currency: payment.currency,
        reason: dto.reason,
        status: stripeRefundId ? 'completed' : 'processing',
        providerRefundId: stripeRefundId,
        refundedBy: adminUserId,
        completedAt: stripeRefundId ? new Date() : null,
      })
      .returning();

    // Recover credits if order had credits
    let creditsReclaimed = 0;
    if (order.credits > 0) {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, order.userId))
        .limit(1);

      if (user) {
        creditsReclaimed = order.credits;

        await this.db.transaction(async (tx) => {
          // Deduct credits from user
          await tx.update(users)
            .set({
              credits: sql`GREATEST(${users.credits} - ${creditsReclaimed}, 0)`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, order.userId));

          // Record credit usage
          await tx.insert(creditUsage).values({
            userId: order.userId,
            taskId: null,
            credits: -creditsReclaimed,
            action: 'order_refund',
            description: `订单退款回收：${order.orderNumber}`,
            balanceAfter: Math.max((user.credits || 0) - creditsReclaimed, 0),
          });
        });

        this.logger.log(`Credits reclaimed: ${creditsReclaimed} from user ${order.userId}`);
      }
    }

    // Update payment status
    await this.db
      .update(payments)
      .set({
        status: 'refunded',
        refundedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    // Update order status
    await this.db
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    this.logger.log(`Order ${orderId} refunded successfully`);

    return {
      refundId: refund.id,
      amount: Number(refundAmount),
      creditsReclaimed,
    };
  }

  /**
   * Export orders to CSV
   */
  async exportOrders(query: {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
  }): Promise<string> {
    const { status, type } = query;
    const pageSize = 10000; // Max limit for export

    const conditions = [];
    if (status) conditions.push(eq(orders.status, status));
    if (type) conditions.push(eq(orders.type, type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize);

    // Generate CSV
    const headers = [
      'Order Number',
      'User ID',
      'Type',
      'Amount',
      'Currency',
      'Credits',
      'Status',
      'Payment ID',
      'Created At',
      'Completed At',
    ];

    const rows = items.map((order) => [
      order.orderNumber,
      order.userId,
      order.type,
      order.amount,
      order.currency,
      order.credits.toString(),
      order.status,
      order.paymentId || '',
      order.createdAt.toISOString(),
      order.completedAt?.toISOString() || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return csv;
  }

  /**
   * Convert database record to response
   */
  private toResponse(order: typeof orders.$inferSelect): OrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      orderNumber: order.orderNumber,
      type: order.type as any,
      amount: order.amount,
      originalAmount: order.originalAmount,
      discountAmount: order.discountAmount,
      promoCodeId: order.promoCodeId,
      currency: order.currency,
      credits: order.credits,
      status: order.status as OrderStatus,
      paymentId: order.paymentId,
      metadata: (order.metadata as Record<string, unknown>) || {},
      expiresAt: order.expiresAt?.toISOString() || null,
      completedAt: order.completedAt?.toISOString() || null,
      cancelledAt: order.cancelledAt?.toISOString() || null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  // ===== Refund Query Methods =====

  /**
   * List all refunds with pagination and filters
   */
  async listRefunds(query: {
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
    orderId?: string;
  }): Promise<{ items: RefundResponse[]; total: number }> {
    const { page = 1, pageSize = 20, status, userId, orderId } = query;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status) conditions.push(eq(refunds.status, status));
    if (userId) conditions.push(eq(refunds.userId, userId));
    if (orderId) conditions.push(eq(refunds.orderId, orderId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(refunds)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    // Get paginated results with related data
    const items = await this.db
      .select({
        refund: refunds,
        order: orders,
        payment: payments,
        user: users,
      })
      .from(refunds)
      .leftJoin(orders, eq(refunds.orderId, orders.id))
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(users, eq(refunds.userId, users.id))
      .where(whereClause)
      .orderBy(desc(refunds.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((item) => this.toRefundResponse(item)),
      total,
    };
  }

  /**
   * Get refund detail with related information
   */
  async getRefundDetail(refundId: string): Promise<RefundDetailResponse> {
    const [result] = await this.db
      .select({
        refund: refunds,
        order: orders,
        payment: payments,
        user: users,
        admin: users,
      })
      .from(refunds)
      .leftJoin(orders, eq(refunds.orderId, orders.id))
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(users, eq(refunds.userId, users.id))
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!result) {
      throw new NotFoundException('Refund not found');
    }

    // Get admin user info who performed the refund
    let adminInfo = null;
    if (result.refund.refundedBy) {
      const [admin] = await this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, result.refund.refundedBy))
        .limit(1);

      if (admin) {
        adminInfo = {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        };
      }
    }

    return {
      ...this.toRefundResponse(result),
      order: result.order ? this.toResponse(result.order) : null,
      payment: result.payment ? {
        id: result.payment.id,
        amount: result.payment.amount,
        currency: result.payment.currency,
        status: result.payment.status,
        provider: result.payment.provider,
        providerPaymentId: result.payment.providerPaymentId,
        createdAt: result.payment.createdAt.toISOString(),
      } : null,
      user: result.user ? {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      } : null,
      refundedBy: adminInfo,
    };
  }

  /**
   * Get refund statistics
   */
  async getRefundStats(range: string = '30d'): Promise<RefundStatsResponse> {
    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30); // Default to 30 days

    // Get total refunds in date range
    const [totalResult] = await this.db
      .select({
        count: count(),
        totalAmount: sql<number>`COALESCE(SUM(amount), 0)`,
      })
      .from(refunds)
      .where(and(
        eq(refunds.status, 'completed'),
        gte(refunds.createdAt, startDate),
      ));

    const totalRefunds = Number(totalResult?.count || 0);
    const totalRefundedAmount = Number(totalResult?.totalAmount || 0);

    // Get stats by status
    const statusStats = await this.db
      .select({
        status: refunds.status,
        count: count(),
        totalAmount: sql<number>`COALESCE(SUM(amount), 0)`,
      })
      .from(refunds)
      .where(gte(refunds.createdAt, startDate))
      .groupBy(refunds.status);

    const statsByStatus = statusStats.reduce((acc, item) => {
      acc[item.status] = {
        count: Number(item.count),
        totalAmount: Number(item.totalAmount),
      };
      return acc;
    }, {} as Record<string, { count: number; totalAmount: number }>);

    return {
      totalRefunds,
      totalRefundedAmount,
      statsByStatus,
      averageRefundAmount: totalRefunds > 0 ? totalRefundedAmount / totalRefunds : 0,
    };
  }

  /**
   * Export refunds to CSV
   */
  async exportRefunds(query: {
    status?: string;
    userId?: string;
    orderId?: string;
  }): Promise<string> {
    const { status, userId, orderId } = query;
    const pageSize = 10000; // Max limit for export

    const conditions = [];
    if (status) conditions.push(eq(refunds.status, status));
    if (userId) conditions.push(eq(refunds.userId, userId));
    if (orderId) conditions.push(eq(refunds.orderId, orderId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db
      .select({
        refund: refunds,
        order: orders,
        user: users,
      })
      .from(refunds)
      .leftJoin(orders, eq(refunds.orderId, orders.id))
      .leftJoin(users, eq(refunds.userId, users.id))
      .where(whereClause)
      .orderBy(desc(refunds.createdAt))
      .limit(pageSize);

    // Generate CSV
    const headers = [
      'Refund ID',
      'Order Number',
      'User Email',
      'Amount',
      'Currency',
      'Status',
      'Reason',
      'Provider Refund ID',
      'Refunded By',
      'Created At',
      'Completed At',
    ];

    const rows = items.map((item) => [
      item.refund.id,
      item.order?.orderNumber || '',
      item.user?.email || '',
      item.refund.amount,
      item.refund.currency,
      item.refund.status,
      item.refund.reason || '',
      item.refund.providerRefundId || '',
      item.refund.refundedBy || '',
      item.refund.createdAt.toISOString(),
      item.refund.completedAt?.toISOString() || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return csv;
  }

  /**
   * Convert refund database record to response
   */
  private toRefundResponse(item: any): RefundResponse {
    return {
      id: item.refund.id,
      userId: item.refund.userId,
      orderId: item.refund.orderId,
      paymentId: item.refund.paymentId,
      amount: Number(item.refund.amount),
      currency: item.refund.currency,
      reason: item.refund.reason,
      status: item.refund.status,
      providerRefundId: item.refund.providerRefundId,
      refundedBy: item.refund.refundedBy,
      createdAt: item.refund.createdAt.toISOString(),
      completedAt: item.refund.completedAt?.toISOString() || null,
    };
  }
}
