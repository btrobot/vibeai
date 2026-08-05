import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PaymentService } from './payment.service';
import { BillingController } from './billing.controller';

@Module({
  controllers: [BillingController],
  providers: [
    { provide: 'BILLING_SERVICE', useClass: BillingService },
    PaymentService,
  ],
  exports: ['BILLING_SERVICE', PaymentService],
})
export class BillingModule {}