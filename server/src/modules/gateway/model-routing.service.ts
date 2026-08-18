import { Injectable, Logger, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, asc, eq, exists, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../common/drizzle.constants';
import * as schema from '../../db/schema';
import { aiModels, aiPlatforms, capabilityModelRoutes, modelChannels } from '../../db/schema/gateway';
import type { AdapterModel } from './adapters/protocol-adapter.interface';
import { toAdapterModel } from './model-mapper';

@Injectable()
export class ModelRoutingService {
  private readonly logger = new Logger(ModelRoutingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getDefaultModel(capabilitySlug: string): Promise<AdapterModel | null> {
    try {
      const [row] = await this.db
        .select({ model: aiModels })
        .from(capabilityModelRoutes)
        .innerJoin(aiModels, eq(capabilityModelRoutes.modelSlug, aiModels.slug))
        .where(and(
          eq(capabilityModelRoutes.capabilitySlug, capabilitySlug),
          eq(capabilityModelRoutes.isActive, true),
          eq(aiModels.isActive, true),
          sql`${aiModels.capabilities} @> ARRAY[${capabilitySlug}]::text[]`,
          // 路由级 fallback：跳过没有启用渠道（或渠道所属平台停用）的模型
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
        .orderBy(asc(capabilityModelRoutes.priority), asc(aiModels.sortOrder))
        .limit(1);

      return row?.model ? toAdapterModel(row.model) : null;
    } catch (error) {
      this.logger.error(`Failed to resolve default model for "${capabilitySlug}": ${(error as Error).message}`);
      throw new ServiceUnavailableException('模型路由配置暂时不可用');
    }
  }
}
