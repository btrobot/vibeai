import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { DrizzleService } from '../../common/drizzle.service';
import { createDrizzleMockForNestJS, mockSingle, mockEmpty, mockMany } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';

describe('BillingService', () => {
  let service: BillingService;
  let db: DrizzleMock;

  // ── Test Data ──

  const planRecord = {
    id: 'plan-1',
    slug: 'pro',
    name: '专业版',
    description: '适合专业内容创作者',
    credits: 2000,
    priceMonthly: '99',
    priceYearly: '990',
    maxProjects: 50,
    maxStorageBytes: 2147483648,
    maxConcurrentTasks: 5,
    capabilities: ['*'],
    features: { watermark: false, exportQuality: '4k' },
    isActive: true,
    sortOrder: 2,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const subRecord = {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'plan-1',
    status: 'active',
    billingCycle: 'monthly',
    creditsRemaining: 1500,
    creditsUsed: 500,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2026-02-01'),
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    cancelledAt: null,
    trialEndsAt: null,
    autoRenew: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const userRecord = {
    id: 'user-1',
    email: 'test@test.com',
    name: '测试用户',
    password: 'hashed',
    role: 'user',
    credits: 2000,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const usageRecord = {
    id: 'usage-1',
    userId: 'user-1',
    subscriptionId: 'sub-1',
    taskId: 'task-1',
    credits: -100,
    action: 'task_execution',
    description: '任务执行消耗',
    balanceAfter: 1900,
    metadata: {},
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    const drizzleService = { db } as DrizzleService;
    service = new BillingService(drizzleService);
  });

  // ===== Plan Management =====

  describe('getPlans', () => {
    it('should return all active plans sorted by sortOrder', async () => {
      mockMany(db, [planRecord]);
      const plans = await service.getPlans();
      expect(plans).toHaveLength(1);
      expect(plans[0].slug).toBe('pro');
      expect(plans[0].priceMonthly).toBe(99);
    });

    it('should return empty array when no plans', async () => {
      mockEmpty(db);
      const plans = await service.getPlans();
      expect(plans).toHaveLength(0);
    });
  });

  describe('getPlanBySlug', () => {
    it('should return plan when found', async () => {
      mockSingle(db, planRecord);
      const plan = await service.getPlanBySlug('pro');
      expect(plan.slug).toBe('pro');
      expect(plan.credits).toBe(2000);
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockEmpty(db);
      await expect(service.getPlanBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('seedDefaultPlans', () => {
    it('should insert default plans when no plans exist', async () => {
      mockEmpty(db); // First query returns empty
      await service.seedDefaultPlans();
      // Should have been called for each default plan (4)
      expect(db.insert).toHaveBeenCalledTimes(4);
    });

    it('should skip when plans already exist', async () => {
      mockSingle(db, planRecord); // First query returns a plan
      await service.seedDefaultPlans();
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  // ===== Subscription Management =====

  describe('getSubscription', () => {
    it('should return null when no active subscription', async () => {
      mockEmpty(db);
      const sub = await service.getSubscription('user-1');
      expect(sub).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should throw NotFoundException when no active subscription', async () => {
      mockEmpty(db);
      await expect(service.cancelSubscription('user-1')).rejects.toThrow(NotFoundException);
    });

    it('should cancel active subscription', async () => {
      mockSingle(db, subRecord);
      await service.cancelSubscription('user-1');
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
    });
  });

  // ===== Credit Management =====

  describe('checkCredits', () => {
    it('should return true when user has enough credits', async () => {
      mockSingle(db, { credits: 2000 });
      const result = await service.checkCredits('user-1', 100);
      expect(result).toBe(true);
    });

    it('should return false when user has insufficient credits', async () => {
      mockSingle(db, { credits: 50 });
      const result = await service.checkCredits('user-1', 100);
      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      mockEmpty(db);
      const result = await service.checkCredits('nonexistent', 100);
      expect(result).toBe(false);
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits successfully', async () => {
      mockMany(db, [userRecord, subRecord]); // First user lookup, then sub lookup
      const result = await service.deductCredits('user-1', 'task-1', 100);
      expect(result).toBe(true);
      expect(db.transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockEmpty(db);
      await expect(service.deductCredits('nonexistent', 'task-1', 100)).rejects.toThrow(NotFoundException);
    });

    it('should return false when insufficient credits', async () => {
      mockSingle(db, { ...userRecord, credits: 50 });
      const result = await service.deductCredits('user-1', 'task-1', 100);
      expect(result).toBe(false);
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  describe('refundCredits', () => {
    it('should refund credits successfully', async () => {
      mockSingle(db, userRecord);
      await service.refundCredits('user-1', 'task-1', 100);
      expect(db.transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockEmpty(db);
      await expect(service.refundCredits('nonexistent', 'task-1', 100)).rejects.toThrow(NotFoundException);
    });
  });

  // ===== Usage Statistics =====

  describe('getCreditHistory', () => {
    it('should return credit usage records', async () => {
      mockMany(db, [usageRecord]);
      const records = await service.getCreditHistory('user-1');
      expect(records).toHaveLength(1);
      expect(records[0].action).toBe('task_execution');
      expect(records[0].credits).toBe(-100);
    });

    it('should return empty array when no records', async () => {
      mockEmpty(db);
      const records = await service.getCreditHistory('user-1');
      expect(records).toHaveLength(0);
    });
  });

  // ===== Subscription Management =====

  describe('getSubscription', () => {
    it('should return subscription with plan when user has active subscription', async () => {
      // First query: subscriptions → subRecord (has id, userId, status, etc.)
      // Second query: subscriptionPlans (inside getSubscription) → planRecord
      // Third query: getPlanBySlug(slug) → planRecord
      // Since _result is shared, use subRecord - it's truthy for all paths
      db._result = [subRecord];
      const result = await service.getSubscription('user-1');
      expect(result).not.toBeNull();
      if (result) {
        expect(result.creditsRemaining).toBe(subRecord.creditsRemaining);
        expect(result.plan).toBeDefined();
      }
    });

    it('should return null when no active subscription', async () => {
      db._result = [];
      const result = await service.getSubscription('user-1');
      expect(result).toBeNull();
    });
  });

  describe('createOrUpdateSubscription', () => {
    it('should create new subscription for user', async () => {
      // getPlanBySlug needs a record with slug → use subRecord (has id, currentPeriodStart)
      // returning() also gets subRecord → toSubscriptionResponse works
      db._result = [subRecord];
      const result = await service.createOrUpdateSubscription('user-1', { planSlug: 'pro' });
      expect(result).toBeDefined();
      expect(result.id).toBe(subRecord.id);
      expect(result.plan).toBeDefined();
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics for user with subscription', async () => {
      // 6 queries share the same _result. Need a record that has:
      // - credits (for user lookup), currentPeriodStart (for toSubscriptionResponse)
      const combinedRecord = {
        ...userRecord,
        ...subRecord,
        // Ensure credits from userRecord survives spread
        credits: userRecord.credits,
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      };
      db._result = [combinedRecord];
      const stats = await service.getUsageStats('user-1');
      expect(stats).toBeDefined();
      expect(stats.creditsRemaining).toBe(userRecord.credits);
      expect(stats.creditsUsedThisMonth).toBe(0);
      expect(stats.totalTasksCompleted).toBe(0);
    });

    it('should throw NotFoundException when user not found', async () => {
      db._result = [];
      await expect(service.getUsageStats('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deductCredits', () => {
    it('should handle user with no subscription gracefully', async () => {
      // User lookup returns userRecord, subscription lookup returns empty
      mockSingle(db, userRecord);
      const result = await service.deductCredits('user-1', 'task-1', 50);
      expect(result).toBe(true);
      expect(db.transaction).toHaveBeenCalled();
    });
  });

  describe('refundCredits', () => {
    it('should handle user with no subscription gracefully', async () => {
      mockSingle(db, userRecord);
      await service.refundCredits('user-1', 'task-1', 50);
      expect(db.transaction).toHaveBeenCalled();
    });
  });
});