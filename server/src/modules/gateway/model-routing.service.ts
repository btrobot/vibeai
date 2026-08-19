import { Injectable, Logger, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, asc, eq, exists, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../common/drizzle.constants';
import * as schema from '../../db/schema';
import { aiModels, aiPlatforms, capabilityModelRoutes, modelChannels } from '../../db/schema/gateway';
import type { AdapterModel } from './adapters/protocol-adapter.interface';
import { toAdapterModel } from './model-mapper';
import { ProviderService } from './provider.service';

@Injectable()
export class ModelRoutingService {
  private readonly logger = new Logger(ModelRoutingService.name);

  constructor(
    @Inject('PROVIDER_SERVICE') private readonly providerService: ProviderService,
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getDefaultModel(capabilitySlug: string): Promise<AdapterModel | null> {
    try {
      const rows = await this.db
        .select({ model: aiModels })
        .from(capabilityModelRoutes)
        .innerJoin(aiModels, eq(capabilityModelRoutes.modelSlug, aiModels.slug))
        .where(and(
          eq(capabilityModelRoutes.capabilitySlug, capabilitySlug),
          eq(capabilityModelRoutes.isActive, true),
          eq(aiModels.isActive, true),
          sql`${aiModels.capabilities} @> ARRAY[${capabilitySlug}]::text[]`,
          // 快速剪枝：跳过没有启用渠道行（或渠道所属平台停用）的模型
          exists(
            this.db.select({ id: modelChannels.id })
              .from(modelChannels)
              .innerJoin(aiPlatforms, eq(modelChannels.platformId, aiPlatforms.id))
              .where(and(
                eq(modelChannels.modelSlug, aiModels.slug),
                eq(modelChannels.isActive, true),
                eq(aiPlatforms.isActive, true),
              )),
          ),
        ))
        .orderBy(asc(capabilityModelRoutes.priority), asc(aiModels.sortOrder));

      // 路由级 fallback（对齐 boli：凭证可解析才算可用渠道）：
      // 按 priority 遍历候选模型，取第一个存在"凭证完整可用渠道"的模型。
      // 渠道行存在但 key 不完整（isChannelConfigured 过滤）的模型在此被跳过，
      // 而不是等到任务执行时才报"没有可用的渠道"。
      for (const row of rows) {
        const providers = await this.providerService.getAvailableProviders(row.model.slug);
        if (providers.length > 0) {
          return toAdapterModel(row.model);
        }
        this.logger.warn(
          `Model "${row.model.slug}" (capability=${capabilitySlug}) 无可用渠道，跳过并尝试路由表中下一个模型`,
        );
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to resolve default model for "${capabilitySlug}": ${(error as Error).message}`);
      throw new ServiceUnavailableException('模型路由配置暂时不可用');
    }
  }
}
