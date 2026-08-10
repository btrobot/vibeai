import { describe, it, expect, beforeEach } from 'vitest';
import { PromoCodeService } from '../services/promo-code.service';
import { createDrizzleMockForNestJS, mockSingle, mockMany, mockEmpty } from '../../../test/drizzle-mock';
import { CreatePromoCodeDto, UpdatePromoCodeDto, ValidatePromoCodeDto, PromoCodeType } from '../dto/promo-code.dto';

describe('PromoCodeService', () => {
  let service: PromoCodeService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new PromoCodeService(db as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a fixed discount promo code', async () => {
      const dto: CreatePromoCodeDto = {
        code: 'FIXED10',
        type: PromoCodeType.FIXED,
        value: 10,
        maxUses: 100,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-12-31T23:59:59.999Z',
        minAmount: 50,
      };

      // Mock: code doesn't exist
      mockEmpty(db);

      // Mock: insert returns created promo code
      const createdPromo = {
        id: 'promo-123',
        code: 'FIXED10',
        type: 'fixed',
        value: '10.00',
        maxUses: 100,
        usedCount: 0,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
        minAmount: '50.00',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSingle(db, createdPromo);

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.code).toBe('FIXED10');
      expect(result.type).toBe('fixed');
      expect(Number(result.value)).toBe(10);
    });

    it('should create a percentage discount promo code', async () => {
      const dto: CreatePromoCodeDto = {
        code: 'PERCENT20',
        type: PromoCodeType.PERCENTAGE,
        value: 20,
      };

      // Mock: code doesn't exist
      mockEmpty(db);

      // Mock: insert returns created promo code
      const createdPromo = {
        id: 'promo-123',
        code: 'PERCENT20',
        type: 'percentage',
        value: '20.00',
        maxUses: null,
        usedCount: 0,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSingle(db, createdPromo);

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.type).toBe('percentage');
    });

    it('should throw error for invalid percentage', async () => {
      const dto: CreatePromoCodeDto = {
        code: 'INVALID',
        type: PromoCodeType.PERCENTAGE,
        value: 150, // Invalid: > 100
      };

      await expect(service.create(dto)).rejects.toThrow('must be between 0 and 100');
    });

    it('should throw error for invalid fixed amount', async () => {
      const dto: CreatePromoCodeDto = {
        code: 'INVALID',
        type: PromoCodeType.FIXED,
        value: -10, // Invalid: < 0
      };

      await expect(service.create(dto)).rejects.toThrow('must be greater than 0');
    });

    it('should convert code to uppercase', async () => {
      const dto: CreatePromoCodeDto = {
        code: 'lowercase',
        type: PromoCodeType.FIXED,
        value: 10,
      };

      // Mock: code doesn't exist
      mockEmpty(db);

      // Mock: insert returns created promo code with uppercase code
      const createdPromo = {
        id: 'promo-123',
        code: 'LOWERCASE',
        type: 'fixed',
        value: '10.00',
        maxUses: null,
        usedCount: 0,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSingle(db, createdPromo);

      const result = await service.create(dto);
      expect(result.code).toBe('LOWERCASE');
    });
  });

  describe('validate', () => {
    it('should validate valid fixed promo code', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'VALID10',
        type: 'fixed',
        value: '10.00',
        maxUses: 100,
        usedCount: 5,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T23:59:59.999Z'),
        minAmount: '50.00',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);

      // Mock: no user usage
      mockSingle(db, { count: '0' });

      const dto: ValidatePromoCodeDto = {
        code: 'VALID10',
        orderAmount: 100,
      };

      const result = await service.validate(dto);

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(10);
      expect(result.message).toContain('successfully');
    });

    it('should validate valid percentage promo code', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'PERCENT20',
        type: 'percentage',
        value: '20.00',
        maxUses: null,
        usedCount: 0,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);
      mockSingle(db, { count: '0' });

      const dto: ValidatePromoCodeDto = {
        code: 'PERCENT20',
        orderAmount: 100,
      };

      const result = await service.validate(dto);

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(20); // 20% of 100
    });

    it('should reject inactive promo code', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'INACTIVE',
        type: 'fixed',
        value: '10.00',
        maxUses: 100,
        usedCount: 0,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);

      const dto: ValidatePromoCodeDto = {
        code: 'INACTIVE',
        orderAmount: 100,
      };

      const result = await service.validate(dto);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('inactive');
    });

    it('should reject expired promo code', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'EXPIRED',
        type: 'fixed',
        value: '10.00',
        maxUses: 100,
        usedCount: 0,
        validFrom: new Date('2025-01-01T00:00:00.000Z'),
        validUntil: new Date('2025-12-31T23:59:59.999Z'),
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);

      const dto: ValidatePromoCodeDto = {
        code: 'EXPIRED',
        orderAmount: 100,
      };

      const result = await service.validate(dto);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('expired');
    });

    it('should reject if max uses reached', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'EXHAUSTED',
        type: 'fixed',
        value: '10.00',
        maxUses: 100,
        usedCount: 100,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);

      const dto: ValidatePromoCodeDto = {
        code: 'EXHAUSTED',
        orderAmount: 100,
      };

      const result = await service.validate(dto);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('limit');
    });

    it('should reject if below minimum amount', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'MIN50',
        type: 'fixed',
        value: '10.00',
        maxUses: 100,
        usedCount: 0,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: '50.00',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);
      mockSingle(db, { count: '0' });

      const dto: ValidatePromoCodeDto = {
        code: 'MIN50',
        orderAmount: 30,
      };

      const result = await service.validate(dto);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Minimum');
    });

    it('should reject non-existent promo code', async () => {
      // Mock: promo code not found
      mockEmpty(db);

      const dto: ValidatePromoCodeDto = {
        code: 'NONEXISTENT',
        orderAmount: 100,
      };

      const result = await service.validate(dto);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Invalid');
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'STATS20',
        type: 'percentage',
        value: '20.00',
        maxUses: 100,
        usedCount: 50,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);

      const result = await service.getUsageStats('promo-123');

      expect(result.totalUses).toBe(50);
      expect(result.maxUses).toBe(100);
      expect(result.remainingUses).toBe(50);
      expect(result.isExhausted).toBe(false);
    });

    it('should calculate isExhausted correctly', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'EXHAUSTED',
        type: 'fixed',
        value: '10.00',
        maxUses: 50,
        usedCount: 50,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);

      const result = await service.getUsageStats('promo-123');

      expect(result.isExhausted).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete unused promo code', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'DELETEME',
        type: 'fixed',
        value: '10.00',
        maxUses: 100,
        usedCount: 0,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);

      await expect(service.delete('promo-123')).resolves.not.toThrow();
    });

    it('should prevent deletion of used promo code', async () => {
      const mockPromo = {
        id: 'promo-123',
        code: 'USED',
        type: 'fixed',
        value: '10.00',
        maxUses: 100,
        usedCount: 10,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
        minAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockPromo);

      await expect(service.delete('promo-123')).rejects.toThrow('has been used');
    });
  });
});
