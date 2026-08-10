import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { payments, orders } from '../../db/schema/payments';
import { eq, and, desc, count } from 'drizzle-orm';
import type {
  PaymentResponse,
  CreatePaymentResponse,
  PaymentStatus,
} from './types/payment.types';
import type { CreatePaymentIntentDto } from './dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe;

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        typescript: true,
      } as Stripe.StripeConfig);
      this.logger.log('Stripe initialized');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not configured, running in mock mode');
      this.stripe = null as unknown as Stripe;
    }
  }

  // ===== Payment Creation =====

  /**
   * Create a payment intent (Stripe) or payment record
   */
  async createPayment(
    userId: string,
    dto: CreatePaymentIntentDto,
  ): Promise<CreatePaymentResponse> {
    const { amount, currency = 'USD', provider = 'stripe', orderId, metadata = {} } = dto;

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Verify order exists if orderId provided
    if (orderId) {
      const [order] = await this.db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
        .limit(1);

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Verify order amount matches
      if (Number(order.amount) !== amount) {
        throw new BadRequestException('Amount does not match order total');
      }
    }

    let providerPaymentId: string | null = null;
    let clientSecret: string | undefined;

    // Create Stripe Payment Intent
    if (provider === 'stripe' && this.stripe) {
      try {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          metadata: {
            userId,
            orderId: orderId || '',
            ...metadata,
          },
        });

        providerPaymentId = paymentIntent.id;
        clientSecret = paymentIntent.client_secret || undefined;

        this.logger.log(`Stripe Payment Intent created: ${paymentIntent.id}`);
      } catch (error) {
        this.logger.error(`Failed to create Stripe Payment Intent: ${error}`);
        throw new BadRequestException('Failed to create payment intent');
      }
    }

    // Create payment record in database
    const [payment] = await this.db
      .insert(payments)
      .values({
        userId,
        amount: amount.toString(),
        currency,
        status: 'pending' as const,
        provider,
        providerPaymentId,
        metadata,
      })
      .returning();

    this.logger.log(`Payment created: ${payment.id} (${provider})`);

    return {
      paymentId: payment.id,
      clientSecret,
      amount,
      currency,
      status: payment.status as PaymentStatus,
    };
  }

  // ===== Payment Query =====

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string, userId?: string): Promise<PaymentResponse | null> {
    const whereClause = userId
      ? and(eq(payments.id, paymentId), eq(payments.userId, userId))
      : eq(payments.id, paymentId);

    const [payment] = await this.db.select().from(payments).where(whereClause).limit(1);

    if (!payment) return null;

    return this.toResponse(payment);
  }

  /**
   * List payments with pagination and filtering
   */
  async listPayments(query: {
    page?: number;
    pageSize?: number;
    status?: string;
    provider?: string;
    userId?: string;
  }): Promise<{ items: PaymentResponse[]; total: number }> {
    const { page = 1, pageSize = 20, status, provider, userId } = query;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status) conditions.push(eq(payments.status, status));
    if (provider) conditions.push(eq(payments.provider, provider));
    if (userId) conditions.push(eq(payments.userId, userId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(payments)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    // Get paginated results
    const items = await this.db
      .select()
      .from(payments)
      .where(whereClause)
      .orderBy(desc(payments.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((p) => this.toResponse(p)),
      total,
    };
  }

  // ===== Webhook Handling =====

  /**
   * Verify Stripe webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.stripe) {
      this.logger.warn('Stripe not configured, skipping webhook verification');
      return false;
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not configured');
      return false;
    }

    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      this.logger.log(`Webhook verified: ${event.type}`);
      return true;
    } catch (error) {
      this.logger.error(`Webhook verification failed: ${error}`);
      return false;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    const { type, data } = event;

    switch (type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(data.object as Stripe.PaymentIntent);
        break;
      default:
        this.logger.log(`Unhandled webhook event type: ${type}`);
    }
  }

  /**
   * Handle payment succeeded event
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { id, amount, metadata, status } = paymentIntent;

    // Find payment by providerPaymentId
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, id))
      .limit(1);

    if (!payment) {
      this.logger.warn(`Payment not found for Stripe Payment Intent: ${id}`);
      return;
    }

    if (payment.status === 'completed') {
      this.logger.log(`Payment already completed: ${payment.id}`);
      return;
    }

    // Update payment status
    await this.db
      .update(payments)
      .set({
        status: 'completed' as const,
        completedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    // Update associated order status
    if (metadata.orderId) {
      await this.db
        .update(orders)
        .set({
          status: 'paid',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, metadata.orderId as string));

      this.logger.log(`Order ${metadata.orderId} marked as paid`);
    }

    this.logger.log(`Payment completed: ${payment.id}`);
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { id, last_payment_error } = paymentIntent;

    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, id))
      .limit(1);

    if (!payment) {
      this.logger.warn(`Payment not found for Stripe Payment Intent: ${id}`);
      return;
    }

    await this.db
      .update(payments)
      .set({
        status: 'failed',
        failedAt: new Date(),
        metadata: {
          ...(payment.metadata as Record<string, unknown>),
          lastPaymentError: last_payment_error?.message || 'Payment failed',
        },
      })
      .where(eq(payments.id, payment.id));

    this.logger.log(`Payment failed: ${payment.id}`);
  }

  /**
   * Handle payment canceled event
   */
  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { id } = paymentIntent;

    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, id))
      .limit(1);

    if (!payment) {
      this.logger.warn(`Payment not found for Stripe Payment Intent: ${id}`);
      return;
    }

    // Keep status as pending, can be retried
    this.logger.log(`Payment canceled: ${payment.id}`);
  }

  // ===== Helpers =====

  private toResponse(payment: typeof payments.$inferSelect): PaymentResponse {
    return {
      id: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status as PaymentStatus,
      provider: payment.provider as any,
      providerPaymentId: payment.providerPaymentId,
      metadata: (payment.metadata as Record<string, unknown>) || {},
      createdAt: payment.createdAt.toISOString(),
      completedAt: payment.completedAt?.toISOString() || null,
      failedAt: payment.failedAt?.toISOString() || null,
      refundedAt: payment.refundedAt?.toISOString() || null,
    };
  }
}
