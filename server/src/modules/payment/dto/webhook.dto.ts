import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StripeWebhookDto {
  @ApiProperty({ description: 'Raw webhook payload from Stripe' })
  data!: unknown;

  @ApiProperty({
    description: 'Stripe webhook signature for verification',
    example: 't=...,v1=...',
  })
  signature!: string;
}
