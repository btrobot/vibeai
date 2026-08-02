import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../../common/drizzle.service';
import { subscriptionPlans, subscriptions, creditUsage, invoices } from '../../db/schema/billing';
import { users } from '../../db/schema';
import { eq, and, desc, count, sum, gte, lte, sql } from 'drizzle-orm';
import type {
  PlanResponse,
  SubscriptionResponse,
  CreditUsageResponse,
  UsageStatsResponse,
  CreateSubscriptionInput,
} from '@shared/index';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly drizzle: DrizzleService) {}

  // ===== Plan Management =====

  async getPlans(): Promise<PlanResponse[]> {
    const plans = await this.drizzle.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);

    return plans.map(this.toPlanResponse);
  }

  async getPlanBySlug(slug: string): Promise<PlanResponse> {
    const [plan] = await this.drizzle.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, slug));

    if (!plan) throw new NotFoundException('套餐不存在');
    return this.toPlanResponse(plan);
  }

  async seedDefaultPlans(): Promise<void> {
    const existing = await this.drizzle.db.select().from(subscriptionPlans).limit(1);
    if (existing.length > 0) return;

    const defaultPlans = [
      {
        slug: 'free', name: '免费版', description: '适合个人体验，每日限额',
        credits: 100, priceMonthly: '0', maxProjects: 3, maxStorageBytes: 52428800,
        maxConcurrentTasks: 1, capabilities: ['text-generation', 'image-generation'],
        features: { watermark: true, exportQuality: 'hd' }, sortOrder: 0,
      },
      {
        slug: 'starter', name: '入门版', description: '适合小型电商卖家',
        credits: 500, priceMonthly: '29', maxProjects: 10, maxStorageBytes: 524288000,
        maxConcurrentTasks: 2, capabilities: ['text-generation', 'image-generation', 'background-removal', 'scene-composition'],
        features: { watermark: false, exportQuality: 'hd', priority: 'normal' }, sortOrder: 1,
      },
      {
        slug: 'pro', name: '专业版', description: '适合专业内容创作者',
        credits: 2000, priceMonthly: '99', maxProjects: 50, maxStorageBytes: 2147483648,
        maxConcurrentTasks: 5, capabilities: ['*'],
        features: { watermark: false, exportQuality: '4k', priority: 'high', apiAccess: true }, sortOrder: 2,
      },
      {
        slug: 'enterprise', name: '企业版', description: '适合团队协作，定制化需求',
        credits: 10000, priceMonthly: '299', maxProjects: 999, maxStorageBytes: 10737418240,
        maxConcurrentTasks: 20, capabilities: ['*'],
        features: { watermark: false, exportQuality: '4k', priority: 'highest', apiAccess: true, teamSeats: 10, customModel: true }, sortOrder: 3,
      },
    ];

    for (const plan of defaultPlans) {
      await this.drizzle.db.insert(subscriptionPlans).values(plan);
    }
    this.logger.log('已初始化默认套餐');
  }

  // ===== Subscription Management =====

  async getSubscription(userId: string): Promise<SubscriptionResponse | null> {
    const [sub] = await this.drizzle.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
        ),
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!sub) return null;

    const plan = await this.getPlanBySlug(
      (await this.drizzle.db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).then(r => r[0]))?.slug ?? 'free'
    );

    return {
      ...this.toSubscriptionResponse(sub),
      plan,
    };
  }

  async createOrUpdateSubscription(userId: string, input: CreateSubscriptionInput): Promise<SubscriptionResponse> {
    const plan = await this.getPlanBySlug(input.planSlug);

    // Cancel existing active subscription
    await this.drizzle.db
      .update(subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
        ),
      );

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (input.billingCycle === 'yearly' ? 12 : 1));

    const [sub] = await this.drizzle.db
      .insert(subscriptions)
      .values({
        userId,
        planId: plan.id,
        status: 'active',
        billingCycle: input.billingCycle,
        creditsRemaining: plan.credits,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        autoRenew: true,
      })
      .returning();

    // Update user credits
    await this.drizzle.db
      .update(users)
      .set({ credits: plan.credits, updatedAt: now })
      .where(eq(users.id, userId));

    return {
      ...this.toSubscriptionResponse(sub),
      plan,
    };
  }

  async cancelSubscription(userId: string): Promise<void> {
    const [sub] = await this.drizzle.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
        ),
      )
      .limit(1);

    if (!sub) throw new NotFoundException('没有活跃的订阅');

    await this.drizzle.db
      .update(subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date(), autoRenew: false, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));
  }

  // ===== Credit Management =====

  async deductCredits(userId: string, taskId: string, credits: number, description?: string): Promise<boolean> {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('用户不存在');
    if (user.credits < credits) return false;

    const [sub] = await this.drizzle.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
        ),
      )
      .limit(1);

    const newBalance = user.credits - credits;

    await this.drizzle.db.transaction(async (tx) => {
      // Deduct user credits
      await tx.update(users)
        .set({ credits: newBalance, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Record usage
      await tx.insert(creditUsage).values({
        userId,
        subscriptionId: sub?.id ?? null,
        taskId,
        credits: -credits,
        action: 'task_execution',
        description: description ?? '任务执行消耗',
        balanceAfter: newBalance,
      });

      // Update subscription credits
      if (sub) {
        await tx.update(subscriptions)
          .set({
            creditsRemaining: sql`GREATEST(${sub.creditsRemaining} - ${credits}, 0)`,
            creditsUsed: sql`${sub.creditsUsed} + ${credits}`,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, sub.id));
      }
    });

    this.logger.log(`用户 ${userId} 消耗 ${credits} 额度，剩余 ${newBalance}`);
    return true;
  }

  async refundCredits(userId: string, taskId: string, credits: number, description?: string): Promise<void> {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('用户不存在');

    const newBalance = user.credits + credits;

    await this.drizzle.db.transaction(async (tx) => {
      await tx.update(users)
        .set({ credits: newBalance, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx.insert(creditUsage).values({
        userId,
        taskId,
        credits,
        action: 'task_refund',
        description: description ?? '任务失败额度返还',
        balanceAfter: newBalance,
      });
    });
  }

  // ===== Usage Statistics =====

  async getUsageStats(userId: string): Promise<UsageStatsResponse> {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('用户不存在');

    const sub = await this.getSubscription(userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyUsage] = await this.drizzle.db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(credits)), 0)`,
      })
      .from(creditUsage)
      .where(
        and(
          eq(creditUsage.userId, userId),
          eq(creditUsage.action, 'task_execution'),
          gte(creditUsage.createdAt, monthStart),
        ),
      );

    const [taskStats] = await this.drizzle.db
      .select({
        completed: sql<number>`COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0)`,
        images: sql<number>`COALESCE(COUNT(*) FILTER (WHERE type LIKE 'image-%' AND status = 'completed'), 0)`,
        videos: sql<number>`COALESCE(COUNT(*) FILTER (WHERE type = 'video-generation' AND status = 'completed'), 0)`,
      })
      .from({} as any)
      .where(sql`user_id = ${userId}`);

    return {
      totalCreditsUsed: sub?.creditsUsed ?? 0,
      creditsRemaining: user.credits,
      creditsUsedThisMonth: Number(monthlyUsage?.total ?? 0),
      totalTasksCompleted: taskStats?.completed ?? 0,
      totalImagesGenerated: taskStats?.images ?? 0,
      totalVideosGenerated: taskStats?.videos ?? 0,
      storageUsedBytes: 0,
      planSlug: sub?.plan?.slug ?? 'free',
      planName: sub?.plan?.name ?? '免费版',
      periodStart: sub?.currentPeriodStart ?? now.toISOString(),
      periodEnd: sub?.currentPeriodEnd ?? null,
    };
  }

  async getCreditHistory(userId: string, limit = 50): Promise<CreditUsageResponse[]> {
    const records = await this.drizzle.db
      .select()
      .from(creditUsage)
      .where(eq(creditUsage.userId, userId))
      .orderBy(desc(creditUsage.createdAt))
      .limit(limit);

    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      taskId: r.taskId,
      credits: r.credits,
      action: r.action,
      description: r.description,
      balanceAfter: r.balanceAfter,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ===== Check Credits =====

  async checkCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const [user] = await this.drizzle.db
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return false;
    return user.credits >= requiredCredits;
  }

  // ===== Private Helpers =====

  private toPlanResponse(p: typeof subscriptionPlans.$inferSelect): PlanResponse {
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      credits: p.credits,
      priceMonthly: Number(p.priceMonthly),
      priceYearly: p.priceYearly ? Number(p.priceYearly) : null,
      maxProjects: p.maxProjects,
      maxStorageBytes: p.maxStorageBytes,
      maxConcurrentTasks: p.maxConcurrentTasks,
      capabilities: p.capabilities ?? [],
      features: p.features as Record<string, unknown>,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private toSubscriptionResponse(s: typeof subscriptions.$inferSelect): SubscriptionResponse {
    return {
      id: s.id,
      userId: s.userId,
      planId: s.planId,
      plan: null,
      status: s.status as SubscriptionResponse['status'],
      billingCycle: s.billingCycle as SubscriptionResponse['billingCycle'],
      creditsRemaining: s.creditsRemaining,
      creditsUsed: s.creditsUsed,
      currentPeriodStart: s.currentPeriodStart.toISOString(),
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
      autoRenew: s.autoRenew,
      createdAt: s.createdAt.toISOString(),
    };
  }
}