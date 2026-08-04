import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  controllers: [BillingController],
  providers: [{ provide: 'BILLING_SERVICE', useClass: BillingService }],
  exports: ['BILLING_SERVICE'],
})
export class BillingModule {}