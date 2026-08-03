import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { TaskExecutionService } from './task-execution.service';
import { DrizzleModule } from '../../common/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [GatewayController],
  providers: [GatewayService, TaskExecutionService],
  exports: [GatewayService, TaskExecutionService],
})
export class GatewayModule {}