import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from '../order.service';
import { PromoCodeService } from '../../commerce/services/promo-code.service';
import { createDrizzleMockForNestJS, mockSingle, mockEmpty } from '../../../test/drizzle-mock';
import { BadRequestException } from '@nestjs/common';
import { OrderType } from '../types/order.types';

describe('OrderService + PromoCode integration', () => {
  let service: OrderService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;
  let promoService: PromoCodeService;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    promoService = {
      validate: vi.fn(),
      applyCode: vi.fn(),
    } as any;
    service = new OrderService(db as any, promoService);
  });

  it('should apply promo code discount to order', async () => {
    (promoService.validate as any).mockResolvedValue({
      isValid: true,
      discountAmount: 20,
      message: 'ok',
      promoCode: { id: 'promo-1', code: 'SAVE20', type: 'fixed', value: 20 },
    });

    // insert returning
    mockSingle(db, {
      id: 'order-1',
      userId: 'u1',
      orderNumber: 'ORD-1',
      type: 'credit_pack',
      amount: '80.00',
      originalAmount: '100.00',
      discountAmount: '20.00',
      promoCodeId: 'promo-1',
      currency: 'USD',
      credits: 100,
      status: 'pending',
      paymentId: null,
      metadata: { promoCode: 'SAVE20' },
      expiresAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createOrder('u1', {
      type: OrderType.CREDIT_PACK,
      amount: 100,
      promoCode: 'SAVE20',
    });

    expect(promoService.validate).toHaveBeenCalledWith({
      code: 'SAVE20',
      orderAmount: 100,
      userId: 'u1',
    });
    expect(result.amount).toBe(80);
  });

  it('should reject invalid promo code', async () => {
    (promoService.validate as any).mockResolvedValue({
      isValid: false,
      message: 'Promo code has expired',
    });

    await expect(
      service.createOrder('u1', {
        type: OrderType.CREDIT_PACK,
        amount: 100,
        promoCode: 'EXPIRED',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should record promo usage on order completion', async () => {
    (promoService.applyCode as any).mockResolvedValue({});

    // update returning
    mockSingle(db, {
      id: 'order-1',
      userId: 'u1',
      orderNumber: 'ORD-1',
      type: 'credit_pack',
      amount: '80.00',
      originalAmount: '100.00',
      discountAmount: '20.00',
      promoCodeId: 'promo-1',
      currency: 'USD',
      credits: 100,
      status: 'completed',
      paymentId: null,
      metadata: { promoCode: 'SAVE20' },
      expiresAt: null,
      completedAt: new Date(),
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.updateOrderStatus('order-1', 'completed' as any);

    expect(promoService.applyCode).toHaveBeenCalledWith('SAVE20', 'u1', 'order-1');
  });

  it('should not record promo usage when no promo applied', async () => {
    mockSingle(db, {
      id: 'order-2',
      userId: 'u1',
      orderNumber: 'ORD-2',
      type: 'credit_pack',
      amount: '100.00',
      originalAmount: null,
      discountAmount: '0.00',
      promoCodeId: null,
      currency: 'USD',
      credits: 100,
      status: 'completed',
      paymentId: null,
      metadata: {},
      expiresAt: null,
      completedAt: new Date(),
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.updateOrderStatus('order-2', 'completed' as any);

    expect(promoService.applyCode).not.toHaveBeenCalled();
  });
});
