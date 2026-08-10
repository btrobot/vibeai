import { IsNumber, IsString, IsOptional, IsEnum, IsObject, Min, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '../types/order.types';

export class CreateOrderDto {
  @ApiProperty({ example: 'credit_pack', description: '订单类型', enum: OrderType })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiProperty({ example: 9.99, description: '订单金额' })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', description: '货币代码' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 100, description: '积分数' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  credits?: number;

  @ApiPropertyOptional({
    description: '订单明细（支持多商品）',
    example: [
      { itemType: 'credit_pack', itemId: 'pack-001', name: '100 Credit Pack', quantity: 1, unitPrice: 9.99 },
    ],
  })
  @IsArray()
  @IsOptional()
  items?: OrderItemDto[];

  @ApiPropertyOptional({
    description: '元数据（如促销码、备注等）',
    example: { promoCode: 'SAVE20' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '过期时间（ISO 8601格式）' })
  @IsString()
  @IsOptional()
  expiresAt?: string;
}

export class OrderItemDto {
  @ApiProperty({ example: 'credit_pack', description: '商品类型' })
  @IsString()
  itemType!: string;

  @ApiPropertyOptional({ example: 'pack-001', description: '商品 ID' })
  @IsString()
  @IsOptional()
  itemId?: string;

  @ApiProperty({ example: '100 Credit Pack', description: '商品名称' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '商品描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 1, description: '数量' })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 9.99, description: '单价' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 100, description: '积分数' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  credits?: number;
}
