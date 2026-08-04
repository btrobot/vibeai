import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [TaskController],
  providers: [{ provide: 'TASK_SERVICE', useClass: TaskService }],
  exports: ['TASK_SERVICE'],
})
export class TaskModule {}