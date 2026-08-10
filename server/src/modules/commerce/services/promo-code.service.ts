import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { promoCodes, userPromoUses } from '../../../db/schema/commerce';
import { eq, and, desc, asc, or, ilike, sql, count } from 'drizzle-orm';
import type {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  ListPromoCodesDto,
  PromoCodeResponseDto,
  ValidatePromoCodeDto,
  PromoCodeValidationResponseDto,
  PromoCodeUsageStatsResponseDto,
  PromoCodeType,
} from '../dto/promo-code.dto';

@Injectable()
export class PromoCodeService {
  private readonly logger = new Logger(PromoCodeService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Create a new promo code
   */
  async create(dto: CreatePromoCodeDto): Promise<PromoCodeResponseDto> {
    this.logger.log(`Creating promo code: ${dto.code}`);

    // Check if code already exists
    const existing = await this.db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, dto.code.toUpperCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new BadRequestException(`Promo code "${dto.code}" already exists`);
    }

    // Validate percentage discount
    if (dto.type === 'percentage' && (dto.value < 0 || dto.value > 100)) {
      throw new BadRequestException('Percentage discount must be between 0 and 100');
    }

    // Validate fixed discount
    if (dto.type === 'fixed' && dto.value <= 0) {
      throw new BadRequestException('Fixed discount must be greater than 0');
    }

    // Validate dates
    if (dto.validUntil && dto.validFrom) {
      const fromDate = new Date(dto.validFrom);
      const untilDate = new Date(dto.validUntil);
      if (untilDate <= fromDate) {
        throw new BadRequestException('validUntil must be after validFrom');
      }
    }

    const [promoCode] = await this.db
      .insert(promoCodes)
      .values({
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value.toString(),
        maxUses: dto.maxUses || null,
        usedCount: 0,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        minAmount: dto.minAmount?.toString() || null,
        isActive: dto.isActive ?? true,
      })
      .returning();

    this.logger.log(`Promo code created: ${promoCode.id}`);
    return this.toResponseDto(promoCode);
  }

  /**
   * Update a promo code
   */
  async update(id: string, dto: UpdatePromoCodeDto): Promise<PromoCodeResponseDto> {
    this.logger.log(`Updating promo code: ${id}`);

    const promoCode = await this.getById(id);
    if (!promoCode) {
      throw new NotFoundException(`Promo code not found: ${id}`);
    }

    // If updating code, check for conflicts
    if (dto.code && dto.code.toUpperCase() !== promoCode.code) {
      const existing = await this.db
        .select()
        .from(promoCodes)
        .where(and(eq(promoCodes.code, dto.code.toUpperCase()), sql`${promoCodes.id} != ${id}`))
        .limit(1);

      if (existing.length > 0) {
        throw new BadRequestException(`Promo code "${dto.code}" already exists`);
      }
    }

    // Validate percentage discount
    if (dto.type === 'percentage' && dto.value !== undefined) {
      if (dto.value < 0 || dto.value > 100) {
        throw new BadRequestException('Percentage discount must be between 0 and 100');
      }
    }

    // Validate fixed discount
    if (dto.type === 'fixed' && dto.value !== undefined) {
      if (dto.value <= 0) {
        throw new BadRequestException('Fixed discount must be greater than 0');
      }
    }

    const updateData: any = {
      ...dto,
      code: dto.code ? dto.code.toUpperCase() : undefined,
      value: dto.value !== undefined ? dto.value.toString() : undefined,
      minAmount: dto.minAmount !== undefined ? dto.minAmount.toString() : undefined,
      updatedAt: new Date(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const [updated] = await this.db
      .update(promoCodes)
      .set(updateData)
      .where(eq(promoCodes.id, id))
      .returning();

    this.logger.log(`Promo code updated: ${id}`);
    return this.toResponseDto(updated);
  }

  /**
   * Delete a promo code
   */
  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting promo code: ${id}`);

    const promoCode = await this.getById(id);
    if (!promoCode) {
      throw new NotFoundException(`Promo code not found: ${id}`);
    }

    // Check if promo code has been used
    if (promoCode.usedCount > 0) {
      throw new BadRequestException('Cannot delete promo code that has been used. Deactivate it instead.');
    }

    await this.db.delete(promoCodes).where(eq(promoCodes.id, id));

    this.logger.log(`Promo code deleted: ${id}`);
  }

  /**
   * List promo codes with pagination and filtering
   */
  async list(dto: ListPromoCodesDto): Promise<{ items: PromoCodeResponseDto[]; total: number }> {
    const { page = 1, pageSize = 20, isActive, type, search } = dto;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (isActive !== undefined) {
      conditions.push(eq(promoCodes.isActive, isActive));
    }

    if (type !== undefined) {
      conditions.push(eq(promoCodes.type, type));
    }

    if (search) {
      conditions.push(ilike(promoCodes.code, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(promoCodes)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    // Get items
    const items = await this.db
      .select()
      .from(promoCodes)
      .where(whereClause)
      .orderBy(desc(promoCodes.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((item) => this.toResponseDto(item)),
      total,
    };
  }

  /**
   * Get promo code by ID
   */
  async getById(id: string): Promise<PromoCodeResponseDto | null> {
    const [promoCode] = await this.db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.id, id))
      .limit(1);

    if (!promoCode) {
      return null;
    }

    return this.toResponseDto(promoCode);
  }

  /**
   * Get promo code by code
   */
  async getByCode(code: string): Promise<PromoCodeResponseDto | null> {
    const [promoCode] = await this.db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, code.toUpperCase()))
      .limit(1);

    if (!promoCode) {
      return null;
    }

    return this.toResponseDto(promoCode);
  }

  /**
   * Validate a promo code
   */
  async validate(dto: ValidatePromoCodeDto): Promise<PromoCodeValidationResponseDto> {
    this.logger.log(`Validating promo code: ${dto.code} for amount: ${dto.orderAmount}`);

    const promoCode = await this.getByCode(dto.code);

    if (!promoCode) {
      return {
        isValid: false,
        message: 'Invalid promo code',
      };
    }

    // Check if active
    if (!promoCode.isActive) {
      return {
        isValid: false,
        message: 'Promo code is inactive',
      };
    }

    // Check validity period
    const now = new Date();
    const validFrom = new Date(promoCode.validFrom);
    const validUntil = promoCode.validUntil ? new Date(promoCode.validUntil) : null;

    if (now < validFrom) {
      return {
        isValid: false,
        message: 'Promo code is not yet valid',
      };
    }

    if (validUntil && now > validUntil) {
      return {
        isValid: false,
        message: 'Promo code has expired',
      };
    }

    // Check usage limit
    if (promoCode.maxUses !== null && promoCode.maxUses !== undefined && promoCode.usedCount >= promoCode.maxUses) {
      return {
        isValid: false,
        message: 'Promo code has reached maximum usage limit',
      };
    }

    // Check minimum amount
    if (promoCode.minAmount !== null && dto.orderAmount < Number(promoCode.minAmount)) {
      return {
        isValid: false,
        message: `Minimum order amount ${promoCode.minAmount} required`,
      };
    }

    // Check per-user limit (if userId provided)
    if (dto.userId) {
      const [userUsage] = await this.db
        .select({ count: count() })
        .from(userPromoUses)
        .where(and(eq(userPromoUses.userId, dto.userId), eq(userPromoUses.promoCodeId, promoCode.id)));

      const usageCount = Number(userUsage?.count || 0);
      // Default per-user limit is 1 unless maxUses is very high
      const perUserLimit = promoCode.maxUses && promoCode.maxUses > 10 ? 10 : 1;

      if (usageCount >= perUserLimit) {
        return {
          isValid: false,
          message: `You have reached the usage limit for this promo code`,
        };
      }
    }

    // Calculate discount
    const discountAmount = this.calculateDiscount(promoCode.type, Number(promoCode.value), dto.orderAmount);

    return {
      isValid: true,
      discountAmount,
      message: 'Promo code applied successfully',
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        type: promoCode.type,
        value: Number(promoCode.value),
      },
    };
  }

  /**
   * Apply promo code (increment usage count)
   */
  async applyCode(code: string, userId: string, orderId?: string): Promise<PromoCodeResponseDto> {
    this.logger.log(`Applying promo code: ${code} for user: ${userId}`);

    const promoCode = await this.getByCode(code);
    if (!promoCode) {
      throw new NotFoundException('Promo code not found');
    }

    // Record usage
    await this.db.insert(userPromoUses).values({
      userId,
      promoCodeId: promoCode.id,
      orderId: orderId || null,
      usedAt: new Date(),
    });

    // Increment used count
    await this.db
      .update(promoCodes)
      .set({
        usedCount: promoCode.usedCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(promoCodes.id, promoCode.id));

    this.logger.log(`Promo code applied: ${code}, usedCount: ${promoCode.usedCount + 1}`);
    return promoCode;
  }

  /**
   * Get promo code usage statistics
   */
  async getUsageStats(id: string): Promise<PromoCodeUsageStatsResponseDto> {
    this.logger.log(`Getting usage stats for promo code: ${id}`);

    const promoCode = await this.getById(id);
    if (!promoCode) {
      throw new NotFoundException(`Promo code not found: ${id}`);
    }

    const totalUses = promoCode.usedCount;
    const discountPerUse = Number(promoCode.value);
    const totalDiscountAmount = promoCode.type === 'fixed'
      ? totalUses * discountPerUse
      : totalUses * discountPerUse; // Note: This is simplified, actual discount depends on order amounts

    const maxUses = promoCode.maxUses !== null ? promoCode.maxUses : undefined;
    const remainingUses = maxUses !== undefined ? maxUses - totalUses : undefined;
    const isExhausted = maxUses !== undefined && totalUses >= maxUses;

    return {
      totalUses,
      totalDiscountAmount,
      maxUses,
      remainingUses,
      isExhausted,
    };
  }

  /**
   * Calculate discount amount
   */
  private calculateDiscount(type: PromoCodeType, value: number, orderAmount: number): number {
    if (type === 'fixed') {
      return Math.min(value, orderAmount); // Can't discount more than order amount
    } else {
      // Percentage
      return (orderAmount * value) / 100;
    }
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(promoCode: any): PromoCodeResponseDto {
    return {
      id: promoCode.id,
      code: promoCode.code,
      type: promoCode.type as PromoCodeType,
      value: Number(promoCode.value),
      maxUses: promoCode.maxUses,
      usedCount: promoCode.usedCount,
      validFrom: promoCode.validFrom.toISOString(),
      validUntil: promoCode.validUntil ? promoCode.validUntil.toISOString() : undefined,
      minAmount: promoCode.minAmount ? Number(promoCode.minAmount) : undefined,
      isActive: promoCode.isActive,
      createdAt: promoCode.createdAt.toISOString(),
      updatedAt: promoCode.updatedAt.toISOString(),
    };
  }
}
