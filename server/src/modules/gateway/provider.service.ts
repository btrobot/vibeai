/**
 * ProviderService — 多 Provider 渠道查询服务
 *
 * 查询逻辑：
 * 1. 查 modelProviders WHERE modelSlug = ? AND isActive = true ORDER BY priority
 * 2. 有记录 → 返回多渠道列表
 * 3. 无记录 → 返回空列表，由任务执行层给出明确错误
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { modelProviders } from '../../db/schema/gateway';
import { eq, and, asc } from 'drizzle-orm';

// ===== Types =====

export interface ProviderInstance {
  providerName: string;
  sdkModelId: string;
  sdkClient: string;
  priority: number;
  costPerCall: number | null;
  costPerSecond: number | null;
  config: Record<string, unknown>;
}

// ===== Service =====

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * 查询模型的所有可用渠道，按优先级排序
   *
   * @param modelSlug 模型 slug
   * @returns 按优先级排序的 ProviderInstance 列表
   */
  async getAvailableProviders(
    modelSlug: string,
  ): Promise<ProviderInstance[]> {
    try {
      const rows = await this.db
        .select()
        .from(modelProviders)
        .where(and(eq(modelProviders.modelSlug, modelSlug), eq(modelProviders.isActive, true)))
        .orderBy(asc(modelProviders.priority));

      if (rows.length > 0) {
        return rows.map((r) => ({
          providerName: r.providerName,
          sdkModelId: r.sdkModelId,
          sdkClient: r.sdkClient,
          priority: r.priority,
          costPerCall: r.costPerCall ? parseFloat(r.costPerCall) : null,
          costPerSecond: r.costPerSecond ? parseFloat(r.costPerSecond) : null,
          config: (r.config as Record<string, unknown>) || {},
        }));
      }
    } catch (e) {
      this.logger.warn(
        `Failed to query modelProviders for "${modelSlug}": ${(e as Error).message}`,
      );
      return [];
    }

    return [];
  }
}
