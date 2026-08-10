import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min, IsBoolean } from 'class-validator';
import { OrderStatus, OrderType } from '../../order/types/order.types';

export class AdminOrderQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiProperty({ required: false, enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ required: false, enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  orderNumber?: string;
}

export class AdminOrderIdParamDto {
  @ApiProperty()
  @IsString()
  id!: string;
}

export class AdminUpdateOrderDto {
  @ApiProperty({ required: false, enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class AdminRefundOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  amount?: number;

  @ApiProperty()
  @IsString()
  reason!: string;
}
