import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../types/payment.types';

export class PaymentQueryDto {
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
    description: '支付状态',
    enum: PaymentStatus,
  })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: '支付渠道' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ description: '用户 ID' })
  @IsString()
  @IsOptional()
  userId?: string;
}

export class PaymentIdParamDto {
  @ApiProperty({ description: '支付 ID' })
  @IsString()
  id!: string;
}
