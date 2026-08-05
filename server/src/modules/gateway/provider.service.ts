/**
 * ProviderService — 多 Provider 渠道查询服务
 *
 * 查询逻辑：
 * 1. 查 modelProviders WHERE modelSlug = ? AND isActive = true ORDER BY priority
 * 2. 有记录 → 返回多渠道列表
 * 3. 无记录 → 回退到 aiModels 自身的 providerName/sdkModelId/sdkClient 构造单元素数组
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { modelProviders, aiModels } from '../../db/schema/gateway';
import { eq, and, asc } from 'drizzle-orm';

// ===== Types =====

export interface ProviderInstance {
  providerName: string;
  sdkModelId: string;
  sdkClient: string;
  priority: number;
  costPerCall: number | null;
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
   * @param fallback 模型自身的默认渠道信息（从 aiModels 行提取）
   * @returns 按优先级排序的 ProviderInstance 列表
   */
  async getAvailableProviders(
    modelSlug: string,
    fallback?: {
      providerName: string;
      sdkModelId: string;
      sdkClient: string;
    },
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
          config: (r.config as Record<string, unknown>) || {},
        }));
      }
    } catch (e) {
      this.logger.warn(
        `Failed to query modelProviders for "${modelSlug}", using fallback: ${(e as Error).message}`,
      );
    }

    // Fallback: construct single-element array from aiModels fields
    if (fallback) {
      return [
        {
          providerName: fallback.providerName,
          sdkModelId: fallback.sdkModelId,
          sdkClient: fallback.sdkClient,
          priority: 0,
          costPerCall: null,
          config: {},
        },
      ];
    }

    // Last resort: query aiModels for the fallback info
    try {
      const [model] = await this.db
        .select()
        .from(aiModels)
        .where(eq(aiModels.slug, modelSlug))
        .limit(1);

      if (model) {
        return [
          {
            providerName: model.providerName,
            sdkModelId: model.sdkModelId,
            sdkClient: model.sdkClient,
            priority: 0,
            costPerCall: null,
            config: {},
          },
        ];
      }
    } catch {
      // fall through
    }

    return [];
  }
}
