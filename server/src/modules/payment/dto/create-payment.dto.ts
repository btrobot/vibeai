import { IsNumber, IsString, IsOptional, IsEnum, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '../types/payment.types';

export class CreatePaymentDto {
  @ApiProperty({ example: 9.99, description: '支付金额' })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', description: '货币代码' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    example: 'stripe',
    description: '支付渠道',
    enum: PaymentProvider,
  })
  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;

  @ApiPropertyOptional({ description: '关联订单 ID' })
  @IsString()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({
    description: '元数据（如促销码、备注等）',
    example: { promoCode: 'SAVE20', description: 'Monthly subscription' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreatePaymentIntentDto extends CreatePaymentDto {
  @ApiPropertyOptional({ description: '支付方式类型（Stripe）' })
  @IsString()
  @IsOptional()
  paymentMethodType?: string; // card | us_bank_account | etc
}
