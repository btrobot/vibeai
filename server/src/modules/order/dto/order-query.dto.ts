import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus, OrderType } from '../types/order.types';

export class OrderQueryDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({
    description: '订单状态',
    enum: OrderStatus,
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: '订单类型',
    enum: OrderType,
  })
  @IsEnum(OrderType)
  @IsOptional()
  type?: OrderType;

  @ApiPropertyOptional({ description: '用户 ID' })
  @IsString()
  @IsOptional()
  userId?: string;
}

export class OrderIdParamDto {
  @ApiProperty({ description: '订单 ID' })
  @IsString()
  id!: string;
}
