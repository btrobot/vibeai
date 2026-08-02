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
});