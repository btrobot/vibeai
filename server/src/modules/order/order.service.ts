import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { orders, orderItems, payments } from '../../db/schema/payments';
import { eq, and, desc, count } from 'drizzle-orm';
import type {
  OrderResponse,
  CreateOrderResponse,
  OrderStatus,
} from './types/order.types';
import type { CreateOrderDto } from './dto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Generate unique order number
   * Format: ORD-YYYYMMDD-XXXXXX
   */
  private generateOrderNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `ORD-${dateStr}-${random}`;
  }

  /**
   * Create an order
   */
  async createOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<CreateOrderResponse> {
    const { type, amount, currency = 'USD', credits = 0, items = [], metadata = {}, expiresAt } = dto;

    // Calculate total from items if provided
    let calculatedAmount = amount;
    let calculatedCredits = credits;

    if (items.length > 0) {
      calculatedAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      calculatedCredits = items.reduce((sum, item) => sum + (item.credits || 0) * item.quantity, 0);
    }

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order
    const [order] = await this.db
      .insert(orders)
      .values({
        userId,
        orderNumber,
        type,
        amount: calculatedAmount.toString(),
        currency,
        credits: calculatedCredits,
        status: 'pending',
        metadata,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    // Create order items if provided
    if (items.length > 0) {
      const orderItemValues = items.map((item) => ({
        orderId: order.id,
        itemType: item.itemType,
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalPrice: (item.unitPrice * item.quantity).toString(),
        credits: item.credits || 0,
        metadata: {},
      }));

      await this.db.insert(orderItems).values(orderItemValues);
    }

    this.logger.log(`Order created: ${order.id} (${orderNumber})`);

    return {
      orderId: order.id,
      orderNumber,
      amount: calculatedAmount,
      currency,
      credits: calculatedCredits,
      status: order.status as OrderStatus,
    };
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, userId?: string): Promise<OrderResponse | null> {
    const whereClause = userId
      ? and(eq(orders.id, orderId), eq(orders.userId, userId))
      : eq(orders.id, orderId);

    const [order] = await this.db.select().from(orders).where(whereClause).limit(1);

    if (!order) return null;

    return this.toResponse(order);
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string, userId?: string): Promise<OrderResponse | null> {
    const whereClause = userId
      ? and(eq(orders.orderNumber, orderNumber), eq(orders.userId, userId))
      : eq(orders.orderNumber, orderNumber);

    const [order] = await this.db.select().from(orders).where(whereClause).limit(1);

    if (!order) return null;

    return this.toResponse(order);
  }

  /**
   * List orders with pagination and filtering
   */
  async listOrders(query: {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
    userId?: string;
  }): Promise<{ items: OrderResponse[]; total: number }> {
    const { page = 1, pageSize = 20, status, type, userId } = query;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status) conditions.push(eq(orders.status, status));
    if (type) conditions.push(eq(orders.type, type));
    if (userId) conditions.push(eq(orders.userId, userId));

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
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    paymentId?: string,
  ): Promise<OrderResponse> {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (paymentId) {
      updateData.paymentId = paymentId;
    }

    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    const [order] = await this.db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.logger.log(`Order status updated: ${orderId} -> ${status}`);

    return this.toResponse(order);
  }

  /**
   * Link payment to order
   */
  async linkPayment(orderId: string, paymentId: string): Promise<OrderResponse> {
    const [order] = await this.db
      .update(orders)
      .set({
        paymentId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.logger.log(`Payment linked to order: ${orderId} <- ${paymentId}`);

    return this.toResponse(order);
  }

  /**
   * Check and expire orders
   * Should be called periodically (e.g., by cron job)
   */
  async expireOrders(): Promise<number> {
    const now = new Date();

    const expiredOrders = await this.db
      .select()
      .from(orders)
      .where(and(
        eq(orders.status, 'pending'),
        // @ts-ignore - Prisma/Drizzle type limitation
        eq(orders.expiresAt, now)
      ));

    let expiredCount = 0;

    for (const order of expiredOrders) {
      await this.db
        .update(orders)
        .set({
          status: 'expired',
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));

      expiredCount++;
    }

    if (expiredCount > 0) {
      this.logger.log(`Expired ${expiredCount} orders`);
    }

    return expiredCount;
  }

  /**
   * Get order with payment details
   */
  async getOrderWithPayment(orderId: string, userId?: string): Promise<OrderResponse & { payment?: any } | null> {
    const order = await this.getOrder(orderId, userId);

    if (!order) return null;

    let payment = null;

    if (order.paymentId) {
      const [paymentRecord] = await this.db
        .select()
        .from(payments)
        .where(eq(payments.id, order.paymentId))
        .limit(1);

      if (paymentRecord) {
        payment = {
          id: paymentRecord.id,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          status: paymentRecord.status,
          provider: paymentRecord.provider,
        };
      }
    }

    return {
      ...order,
      payment,
    };
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
