import { IsString, IsOptional, IsUUID, IsInt, IsBoolean, IsEnum, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Promo code type enum
 */
export enum PromoCodeType {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
}

/**
 * DTO for creating a promo code
 */
export class CreatePromoCodeDto {
  @ApiProperty({ example: 'SUMMER2024', description: '促销码' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'fixed', description: '折扣类型', enum: PromoCodeType })
  @IsEnum(PromoCodeType)
  type!: PromoCodeType;

  @ApiProperty({ example: 10, description: '折扣金额（固定）或百分比（0-100）' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ example: 100, description: '最大使用次数（null = 无限制）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z', description: '有效期开始时间' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z', description: '有效期结束时间（null = 永久）' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ example: 50, description: '最低消费金额（null = 无限制）' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ example: true, description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for updating a promo code
 */
export class UpdatePromoCodeDto {
  @ApiPropertyOptional({ example: 'SUMMER2024', description: '促销码' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'fixed', description: '折扣类型', enum: PromoCodeType })
  @IsOptional()
  @IsEnum(PromoCodeType)
  type?: PromoCodeType;

  @ApiPropertyOptional({ example: 10, description: '折扣金额（固定）或百分比（0-100）' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ example: 100, description: '最大使用次数（null = 无限制）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z', description: '有效期开始时间' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z', description: '有效期结束时间（null = 永久）' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ example: 50, description: '最低消费金额（null = 无限制）' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ example: true, description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for listing promo codes
 */
export class ListPromoCodesDto {
  @ApiPropertyOptional({ example: 1, description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ example: true, description: '筛选激活状态' })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'fixed', description: '筛选类型', enum: PromoCodeType })
  @IsOptional()
  @IsEnum(PromoCodeType)
  type?: PromoCodeType;

  @ApiPropertyOptional({ example: 'SUMMER', description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * DTO for validating a promo code
 */
export class ValidatePromoCodeDto {
  @ApiProperty({ example: 'SUMMER2024', description: '促销码' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 99.99, description: '订单金额' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  orderAmount!: number;

  @ApiPropertyOptional({ example: 'uuid-of-user', description: '用户 ID（用于检查使用次数）' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

/**
 * Response DTO for promo code validation
 */
export class PromoCodeValidationResponseDto {
  @ApiProperty({ example: true, description: '是否有效' })
  isValid!: boolean;

  @ApiPropertyOptional({ example: 10, description: '折扣金额' })
  discountAmount?: number;

  @ApiProperty({ example: '优惠码可用', description: '消息' })
  message!: string;

  @ApiPropertyOptional({ type: Object, description: '促销码信息' })
  promoCode?: {
    id: string;
    code: string;
    type: PromoCodeType;
    value: number;
  };
}

/**
 * Response DTO for promo code usage statistics
 */
export class PromoCodeUsageStatsResponseDto {
  @ApiProperty({ example: 50, description: '总使用次数' })
  totalUses!: number;

  @ApiProperty({ example: 500, description: '折扣总额' })
  totalDiscountAmount!: number;

  @ApiProperty({ example: 100, description: '最大使用次数' })
  maxUses?: number;

  @ApiProperty({ example: 50, description: '剩余使用次数' })
  remainingUses?: number;

  @ApiProperty({ example: true, description: '是否已用完' })
  isExhausted!: boolean;
}

/**
 * Response DTO for promo code
 */
export class PromoCodeResponseDto {
  @ApiProperty({ example: 'uuid', description: '促销码 ID' })
  id!: string;

  @ApiProperty({ example: 'SUMMER2024', description: '促销码' })
  code!: string;

  @ApiProperty({ example: 'fixed', description: '折扣类型', enum: PromoCodeType })
  type!: PromoCodeType;

  @ApiProperty({ example: 10, description: '折扣金额或百分比' })
  value!: number;

  @ApiPropertyOptional({ example: 100, description: '最大使用次数' })
  maxUses?: number;

  @ApiProperty({ example: 50, description: '已使用次数' })
  usedCount!: number;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z', description: '有效期开始时间' })
  validFrom!: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z', description: '有效期结束时间' })
  validUntil?: string;

  @ApiPropertyOptional({ example: 50, description: '最低消费金额' })
  minAmount?: number;

  @ApiProperty({ example: true, description: '是否激活' })
  isActive!: boolean;

  @ApiProperty({ example: '2026-08-10T10:00:00.000Z', description: '创建时间' })
  createdAt!: string;

  @ApiProperty({ example: '2026-08-10T10:00:00.000Z', description: '更新时间' })
  updatedAt!: string;
}

/**
 * Response DTO for promo code list
 */
export class PromoCodeListResponseDto {
  @ApiProperty({ type: [PromoCodeResponseDto], description: '促销码列表' })
  items!: PromoCodeResponseDto[];

  @ApiProperty({ example: 100, description: '总数' })
  total!: number;
}
