import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { subscriptionPlans, subscriptions, invoices } from '../../db/schema/billing';
import { users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import type Stripe from 'stripe';

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface WebhookEventResult {
  processed: boolean;
  action: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private get stripeSecretKey(): string | null {
    return process.env.STRIPE_SECRET_KEY || null;
  }

  private get webhookSecret(): string | null {
    return process.env.STRIPE_WEBHOOK_SECRET || null;
  }

  isPaymentEnabled(): boolean {
    return !!this.stripeSecretKey;
  }

  /**
   * 创建 Stripe Checkout Session
   * 用户完成支付后，Stripe 重定向到 successUrl，同时发送 webhook 通知
   */
  async createCheckoutSession(
    userId: string,
    planSlug: string,
    billingCycle: 'monthly' | 'yearly',
  ): Promise<CheckoutSessionResult> {
    if (!this.isPaymentEnabled()) {
      throw new BadRequestException('支付功能未启用（未配置 STRIPE_SECRET_KEY）');
    }

    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, planSlug))
      .limit(1);

    if (!plan) throw new NotFoundException('套餐不存在');
    if (plan.slug === 'free') throw new BadRequestException('免费套餐无需支付');

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('用户不存在');

    const amount = billingCycle === 'yearly' && plan.priceYearly
      ? parseFloat(plan.priceYearly)
      : parseFloat(plan.priceMonthly);

    if (amount === 0) {
      throw new BadRequestException('该套餐免费，无需支付');
    }

    // Dynamically import Stripe to avoid loading if not configured
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(this.stripeSecretKey!);

    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'cny',
            product_data: {
              name: `${plan.name} - ${billingCycle === 'yearly' ? '年付' : '月付'}`,
              description: plan.description || undefined,
            },
            unit_amount: Math.round(amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      success_url: `${domain}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${domain}/billing?status=cancelled`,
      client_reference_id: JSON.stringify({
        userId,
        planSlug,
        billingCycle,
      }),
    });

    this.logger.log(`Checkout session created: ${session.id} for user ${userId}, plan ${planSlug}`);

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * 处理 Stripe Webhook 事件
   * 主要监听 checkout.session.completed 事件来激活订阅
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookEventResult> {
    if (!this.stripeSecretKey || !this.webhookSecret) {
      throw new BadRequestException('Webhook 处理未启用（未配置 STRIPE_WEBHOOK_SECRET）');
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(this.stripeSecretKey);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException(`Webhook 签名验证失败`);
    }

    this.logger.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        return { processed: true, action: 'subscription_activated' };
      }
      case 'invoice.paid': {
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        return { processed: true, action: 'invoice_recorded' };
      }
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
        return { processed: false, action: 'unhandled' };
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const ref = session.client_reference_id;
    if (!ref) {
      this.logger.error('Checkout session missing client_reference_id');
      return;
    }

    const { userId, planSlug, billingCycle } = JSON.parse(ref);
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, planSlug))
      .limit(1);

    if (!plan) {
      this.logger.error(`Plan not found: ${planSlug}`);
      return;
    }

    // Cancel existing active subscription
    await this.db
      .update(subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
        ),
      );

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    // Create new subscription
    const [sub] = await this.db
      .insert(subscriptions)
      .values({
        userId,
        planId: plan.id,
        status: 'active',
        billingCycle,
        creditsRemaining: plan.credits,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        stripeCustomerId: session.customer as string,
        autoRenew: true,
      })
      .returning();

    // Update user credits
    await this.db
      .update(users)
      .set({ credits: plan.credits, updatedAt: now })
      .where(eq(users.id, userId));

    // Create invoice record
    await this.db.insert(invoices).values({
      userId,
      subscriptionId: sub.id,
      stripeInvoiceId: session.id,
      amount: String(session.amount_total ? session.amount_total / 100 : 0),
      currency: session.currency || 'cny',
      status: 'paid',
      description: `${plan.name} - ${billingCycle === 'yearly' ? '年付' : '月付'}`,
      paidAt: now,
    });

    this.logger.log(`Subscription activated: user=${userId}, plan=${planSlug}, sub=${sub.id}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    // Record invoice for history
    if (!invoice.customer_email) return;

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, invoice.customer_email))
      .limit(1);

    if (!user) return;

    // Check if invoice already recorded (idempotency)
    const [existing] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, invoice.id))
      .limit(1);

    if (existing) {
      this.logger.log(`Invoice ${invoice.id} already recorded, skipping`);
      return;
    }

    await this.db.insert(invoices).values({
      userId: user.id,
      stripeInvoiceId: invoice.id,
      amount: String(invoice.total / 100),
      currency: invoice.currency || 'cny',
      status: 'paid',
      description: invoice.description || 'Stripe Invoice',
      paidAt: new Date(),
    });

    this.logger.log(`Invoice recorded: ${invoice.id} for user ${user.id}`);
  }
}
