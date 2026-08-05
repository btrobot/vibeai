import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { createDrizzleMockForNestJS, mockSingle, mockEmpty, mockReturning } from '../../test/drizzle-mock';
import { DRIZZLE } from '../../common/drizzle.constants';

// Mock stripe module
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        }),
      },
    },
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_123', client_reference_id: JSON.stringify({ userId: 'user-1', planSlug: 'starter', billingCycle: 'monthly' }), customer: 'cust_123', amount_total: 2900, currency: 'cny' } },
      }),
    },
  })),
}));

describe('PaymentService', () => {
  let service: PaymentService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(async () => {
    db = createDrizzleMockForNestJS();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('isPaymentEnabled', () => {
    it('未配置 STRIPE_SECRET_KEY 时返回 false', () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(service.isPaymentEnabled()).toBe(false);
    });

    it('配置了 STRIPE_SECRET_KEY 时返回 true', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
      expect(service.isPaymentEnabled()).toBe(true);
      delete process.env.STRIPE_SECRET_KEY;
    });
  });

  describe('createCheckoutSession', () => {
    it('未启用支付时抛出异常', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      await expect(
        service.createCheckoutSession('user-1', 'starter', 'monthly'),
      ).rejects.toThrow();
    });

    it('免费套餐应拒绝支付', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
      mockSingle(db, { id: 'plan-1', slug: 'free', name: '免费版', priceMonthly: '0', priceYearly: null, credits: 100, description: null });

      await expect(
        service.createCheckoutSession('user-1', 'free', 'monthly'),
      ).rejects.toThrow();
      delete process.env.STRIPE_SECRET_KEY;
    });
  });

  describe('handleWebhook', () => {
    it('未配置 webhook secret 时抛出异常', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_SECRET_KEY;
      await expect(
        service.handleWebhook(Buffer.from('test'), 'sig_123'),
      ).rejects.toThrow();
    });
  });
});
