import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminOrderService } from './admin-order.service';
import { createDrizzleMockForNestJS, mockSingle, mockEmpty } from '../../../test/drizzle-mock';

describe('AdminOrderService - Refund', () => {
  let service: AdminOrderService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  const orderRecord = {
    id: 'order-1',
    userId: 'user-1',
    orderNumber: 'ORD-20250810-000001',
    type: 'subscription',
    amount: '99.00',
    currency: 'USD',
    credits: 2000,
    status: 'paid',
    paymentId: 'payment-1',
    metadata: {},
    expiresAt: null,
    completedAt: new Date('2026-01-01'),
    cancelledAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const paymentRecord = {
    id: 'payment-1',
    userId: 'user-1',
    amount: '99.00',
    currency: 'USD',
    status: 'completed',
    provider: 'stripe',
    providerPaymentId: 'pi_test_123',
    metadata: {},
    createdAt: new Date('2026-01-01'),
    completedAt: new Date('2026-01-01'),
    failedAt: null,
    refundedAt: null,
  };

  const userRecord = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    password: 'hashed',
    role: 'user',
    credits: 2000,
    isActive: true,
    isEmailVerified: true,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const refundRecord = {
    id: 'refund-1',
    userId: 'user-1',
    paymentId: 'payment-1',
    orderId: 'order-1',
    amount: '99.00',
    currency: 'USD',
    reason: 'Customer request',
    status: 'completed',
    providerRefundId: 're_test_123',
    refundedBy: 'admin-1',
    metadata: {},
    createdAt: new Date('2026-01-01'),
    completedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new AdminOrderService(db as any);
  });

  describe('refundOrder', () => {
    it('should successfully refund order without Stripe (manual mode)', async () => {
      // Setup mock chain
      mockSingle(db, orderRecord);
      mockSingle(db, paymentRecord);
      mockSingle(db, userRecord);
      mockSingle(db, refundRecord);

      // No STRIPE_SECRET_KEY - manual refund mode
      delete process.env.STRIPE_SECRET_KEY;

      const result = await service.refundOrder(
        'order-1',
        { reason: 'Manual refund' },
        'admin-1',
      );

      expect(result.refundId).toBeDefined();
      expect(result.amount).toBeDefined();
      expect(result.creditsReclaimed).toBeGreaterThanOrEqual(0);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockEmpty(db);

      await expect(
        service.refundOrder('order-1', { reason: 'Test' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order is not paid', async () => {
      mockSingle(db, { ...orderRecord, status: 'pending' });

      await expect(
        service.refundOrder('order-1', { reason: 'Test' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when order has no payment', async () => {
      mockSingle(db, { ...orderRecord, paymentId: null });

      await expect(
        service.refundOrder('order-1', { reason: 'Test' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when payment not found', async () => {
      mockSingle(db, orderRecord);
      mockEmpty(db);

      await expect(
        service.refundOrder('order-1', { reason: 'Test' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when payment is not completed', async () => {
      mockSingle(db, orderRecord);
      mockSingle(db, { ...paymentRecord, status: 'pending' });

      await expect(
        service.refundOrder('order-1', { reason: 'Test' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
