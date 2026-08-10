import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { subscriptionPlans, subscriptions, invoices, creditUsage } from '../../db/schema/billing';
import { users } from '../../db/schema';
import { payments, refunds as refundsTable, orders } from '../../db/schema/payments';
import { eq, and, sql } from 'drizzle-orm';
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
   * 创建一次性付款 Checkout Session（积分包等）
   */
  async createOneTimeCheckoutSession(
    userId: string,
    orderId: string,
    amount: number,
    currency: string,
    credits: number,
  ): Promise<CheckoutSessionResult> {
    if (!this.isPaymentEnabled()) {
      throw new BadRequestException('支付功能未启用（未配置 STRIPE_SECRET_KEY）');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('用户不存在');

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
            currency: (currency || 'usd').toLowerCase(),
            product_data: {
              name: `${credits} Credits Pack`,
              description: `Purchase ${credits} credits`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${domain}/orders?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${domain}/orders?status=cancelled`,
      metadata: {
        userId,
        orderId,
        credits: String(credits),
        mode: 'payment',
      },
    });

    this.logger.log(`One-time checkout session created: ${session.id} for order ${orderId}`);

    return {
      sessionId: session.id,
      url: session.url!,
    };
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
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'cny',
            product_data: {
              name: plan.name,
              description: plan.description || undefined,
            },
            unit_amount: Math.round(amount * 100),
            recurring: {
              interval: billingCycle === 'yearly' ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          userId,
          planSlug,
          billingCycle,
        },
      },
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
        return { processed: true, action: 'subscription_created' };
      }
      case 'customer.subscription.created': {
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        return { processed: true, action: 'subscription_confirmed' };
      }
      case 'customer.subscription.updated': {
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        return { processed: true, action: 'subscription_updated' };
      }
      case 'customer.subscription.deleted': {
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        return { processed: true, action: 'subscription_cancelled' };
      }
      case 'invoice.paid': {
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        return { processed: true, action: 'subscription_renewed' };
      }
      case 'invoice.payment_failed': {
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        return { processed: true, action: 'payment_failed' };
      }
      case 'charge.refund.updated': {
        await this.handleChargeRefundUpdated(event.data.object as Stripe.Refund);
        return { processed: true, action: 'refund_updated' };
      }
      case 'charge.refunded': {
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        return { processed: true, action: 'charge_refunded' };
      }
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
        return { processed: false, action: 'unhandled' };
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    // Route by session mode: 'payment' = one-time (credit pack), 'subscription' = recurring
    if (session.mode === 'payment') {
      await this.handleOneTimePaymentCompleted(session);
      return;
    }

    // Subscription flow (original logic)
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

  /**
   * 处理一次性付款完成（积分包购买）
   * Stripe Checkout Session mode='payment' 完成后触发
   */
  private async handleOneTimePaymentCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { userId, orderId, credits } = (session.metadata || {}) as Record<string, string>;

    if (!userId || !orderId) {
      this.logger.error('One-time payment session missing metadata', session.metadata);
      return;
    }

    const creditsNum = Number(credits) || 0;

    // Create payment record
    const [payment] = await this.db
      .insert(payments)
      .values({
        userId,
        amount: String((session.amount_total || 0) / 100),
        currency: session.currency || 'usd',
        status: 'completed',
        provider: 'stripe',
        providerPaymentId: session.payment_intent as string || null,
        metadata: { orderId, sessionId: session.id },
        completedAt: new Date(),
      })
      .returning();

    // Update order: link payment, mark completed
    await this.db
      .update(orders)
      .set({
        paymentId: payment.id,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Grant credits to user
    if (creditsNum > 0) {
      await this.db.transaction(async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user) return;

        const newBalance = (user.credits || 0) + creditsNum;

        await tx.update(users)
          .set({ credits: newBalance, updatedAt: new Date() })
          .where(eq(users.id, userId));

        await tx.insert(creditUsage).values({
          userId,
          taskId: null,
          credits: creditsNum,
          action: 'credit_purchase',
          description: `积分包购买：${creditsNum} 积分`,
          balanceAfter: newBalance,
        });
      });
    }

    this.logger.log(`One-time payment completed: user=${userId}, order=${orderId}, credits=${creditsNum}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    // Record invoice for history and renew credits
    if (!invoice.customer_email && !invoice.customer) return;

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, invoice.customer_email || ''))
      .limit(1);

    if (!user) {
      this.logger.warn(`User not found for invoice ${invoice.id}`);
      return;
    }

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

    // Find subscription by Stripe subscription ID
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, (invoice as any).subscription as string))
      .limit(1);

    if (!sub) {
      this.logger.warn(`Subscription not found for invoice ${invoice.id}`);
      return;
    }

    // Get plan details
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, sub.planId))
      .limit(1);

    if (!plan) {
      this.logger.warn(`Plan not found for subscription ${sub.id}`);
      return;
    }

    // Record invoice
    await this.db.insert(invoices).values({
      userId: user.id,
      subscriptionId: sub.id,
      stripeInvoiceId: invoice.id,
      amount: String(invoice.total / 100),
      currency: invoice.currency || 'cny',
      status: 'paid',
      description: `${plan.name} - 订阅续费`,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      paidAt: new Date(),
    });

    // Renew credits
    await this.db.transaction(async (tx) => {
      // Reset subscription credits
      await tx.update(subscriptions)
        .set({
          creditsRemaining: plan.credits,
          creditsUsed: 0,
          currentPeriodStart: new Date(invoice.period_start * 1000),
          currentPeriodEnd: new Date(invoice.period_end * 1000),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));

      // Add credits to user balance
      await tx.update(users)
        .set({
          credits: sql`${users.credits} + ${plan.credits}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Record credit addition
      await tx.insert(creditUsage).values({
        userId: user.id,
        subscriptionId: sub.id,
        taskId: null,
        credits: plan.credits,
        action: 'plan_renewal',
        description: `订阅续费：${plan.name}`,
        balanceAfter: (user.credits || 0) + plan.credits,
      });
    });

    this.logger.log(`Subscription renewed: user=${user.id}, invoice=${invoice.id}, credits=${plan.credits}`);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    this.logger.warn(`Invoice payment failed: ${invoice.id}, subscription=${(invoice as any).subscription}`);

    // Update subscription status if needed
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, (invoice as any).subscription as string))
      .limit(1);

    if (sub) {
      await this.db.update(subscriptions)
        .set({ status: 'past_due', updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));

      this.logger.log(`Subscription ${sub.id} marked as past_due`);
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Subscription created in Stripe: ${subscription.id}`);
    // Subscription is already created in checkout.session.completed
    // This event confirms the subscription is active in Stripe
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Subscription updated in Stripe: ${subscription.id}`);

    // Sync subscription status from Stripe
    const [existing] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (!existing) {
      this.logger.warn(`Local subscription not found for Stripe subscription ${subscription.id}`);
      return;
    }

    // Map Stripe status to our status
    const statusMap: Record<string, string> = {
      active: 'active',
      past_due: 'past_due',
      canceled: 'cancelled',
      incomplete: 'active',
      incomplete_expired: 'expired',
      trialing: 'trialing',
      unpaid: 'past_due',
    };

    const newStatus = statusMap[subscription.status] || existing.status;

    await this.db.update(subscriptions)
      .set({
        status: newStatus as any,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        autoRenew: !(subscription as any).cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id));

    this.logger.log(`Subscription ${existing.id} updated to status ${newStatus}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Subscription deleted in Stripe: ${subscription.id}`);

    const [existing] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (!existing) {
      this.logger.warn(`Local subscription not found for Stripe subscription ${subscription.id}`);
      return;
    }

    await this.db.update(subscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        autoRenew: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id));

    this.logger.log(`Subscription ${existing.id} cancelled`);
  }

  private async handleChargeRefundUpdated(refund: Stripe.Refund): Promise<void> {
    this.logger.log(`Refund updated in Stripe: ${refund.id}, status: ${refund.status}`);

    // Find existing refund record by Stripe refund ID
    const [existingRefund] = await this.db
      .select()
      .from(refundsTable)
      .where(eq(refundsTable.providerRefundId, refund.id))
      .limit(1);

    if (!existingRefund) {
      this.logger.warn(`Local refund not found for Stripe refund ${refund.id}`);
      return;
    }

    // Map Stripe status to our status
    const statusMap: Record<string, string> = {
      pending: 'pending',
      succeeded: 'completed',
      failed: 'failed',
      canceled: 'rejected',
    };

    const refundStatus = refund.status || 'pending';
    const newStatus = statusMap[refundStatus] || existingRefund.status;

    await this.db.update(refundsTable)
      .set({
        status: newStatus as any,
        completedAt: refund.status === 'succeeded' ? new Date(refund.created * 1000) : null,
      })
      .where(eq(refundsTable.id, existingRefund.id));

    this.logger.log(`Refund ${existingRefund.id} updated to status ${newStatus}`);
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    this.logger.log(`Charge refunded: ${charge.id}, amount: ${charge.amount_refunded}`);

    // This event is sent when a charge is refunded
    // We handle the specific refund in charge.refund.updated
    // This is just for logging/notification purposes
  }
}
