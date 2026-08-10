import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { orders, payments, refunds } from '../../../db/schema/payments';
import { eq, and, desc, count, gte } from 'drizzle-orm';
import type { OrderResponse, OrderStatus } from '../../order/types/order.types';
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
    // This is simplified - in production you'd sum actual payments
    const totalRevenue = paidOrders * 10; // Placeholder calculation

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
   * Refund order
   */
  async refundOrder(
    orderId: string,
    dto: AdminRefundOrderDto,
    adminUserId: string,
  ): Promise<{ refundId: string; amount: number }> {
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
        status: 'pending',
        refundedBy: adminUserId,
      })
      .returning();

    // In production, you would call Stripe API here to create the actual refund
    // const stripeRefund = await this.stripe.refunds.create({
    //   payment_intent: payment.providerPaymentId,
    //   amount: Math.round(Number(refundAmount) * 100),
    //   reason: 'requested_by_customer',
    // });

    this.logger.log(`Refund created: ${refund.id} for order ${orderId}`);

    // Update order status
    await this.db
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return {
      refundId: refund.id,
      amount: Number(refundAmount),
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
}
