import { Module, OnModuleInit } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { TaskExecutionService } from './task-execution.service';
import { LlmAdapter } from './adapters/llm.adapter';
import { ImageAdapter } from './adapters/image.adapter';
import { VideoAdapter } from './adapters/video.adapter';
import { AdapterRegistry } from './adapters/adapter-registry';
import { DrizzleModule } from '../../common/drizzle.module';
import { StorageModule } from '../storage/storage.module';
import { BillingModule } from '../billing/billing.module';
import { CreateModule } from '../create/create.module';

@Module({
  imports: [DrizzleModule, StorageModule, BillingModule, CreateModule],
  controllers: [GatewayController],
  providers: [GatewayService, TaskExecutionService, LlmAdapter, ImageAdapter, VideoAdapter, AdapterRegistry],
  exports: [GatewayService, TaskExecutionService],
})
export class GatewayModule implements OnModuleInit {
  constructor(private readonly gatewayService: GatewayService) {}

  async onModuleInit(): Promise<void> {
    await this.gatewayService.seedModels();
  }
}
