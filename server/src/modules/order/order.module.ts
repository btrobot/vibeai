import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PaymentModule } from '../payment/payment.module';
import { CommerceModule } from '../commerce/commerce.module';
import { DrizzleModule } from '../../common/drizzle.module';

@Module({
  imports: [PaymentModule, CommerceModule, DrizzleModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
