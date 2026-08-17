import { Module, OnModuleInit } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { TaskExecutionService } from './task-execution.service';
import { ProviderService } from './provider.service';
import { ModelRoutingService } from './model-routing.service';
import { ModelConfigService } from './model-config.service';
import { LlmAdapter } from './adapters/llm.adapter';
import { ImageAdapter } from './adapters/image.adapter';
import { VideoAdapter } from './adapters/video.adapter';
import { ReplicateAdapter } from './adapters/replicate.adapter';
import { AdapterRegistry } from './adapters/adapter-registry';
import { DrizzleModule } from '../../common/drizzle.module';
import { StorageModule } from '../storage/storage.module';
import { BillingModule } from '../billing/billing.module';
import { CreateModule } from '../create/create.module';

@Module({
  imports: [DrizzleModule, StorageModule, BillingModule, CreateModule],
  controllers: [GatewayController],
  providers: [
    { provide: 'GATEWAY_SERVICE', useClass: GatewayService },
    { provide: 'TASK_EXECUTION_SERVICE', useClass: TaskExecutionService },
    { provide: 'PROVIDER_SERVICE', useClass: ProviderService },
    { provide: 'MODEL_ROUTING_SERVICE', useClass: ModelRoutingService },
    { provide: 'MODEL_CONFIG_SERVICE', useClass: ModelConfigService },
    { provide: 'LLM_ADAPTER', useClass: LlmAdapter },
    { provide: 'IMAGE_ADAPTER', useClass: ImageAdapter },
    { provide: 'VIDEO_ADAPTER', useClass: VideoAdapter },
    { provide: 'REPLICATE_ADAPTER', useClass: ReplicateAdapter },
    { provide: 'ADAPTER_REGISTRY', useClass: AdapterRegistry },
  ],
  exports: [
    'GATEWAY_SERVICE',
    'TASK_EXECUTION_SERVICE',
    'ADAPTER_REGISTRY',
    'PROVIDER_SERVICE',
    'MODEL_ROUTING_SERVICE',
    'MODEL_CONFIG_SERVICE',
  ],
})
export class GatewayModule implements OnModuleInit {
  constructor() {}

  async onModuleInit(): Promise<void> {
    // seedModels is called from main.ts bootstrap instead
  }
}
