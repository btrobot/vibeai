/**
 * ProviderService — 渠道实例查询服务（平台维度）
 *
 * 数据模型：
 *   ai_platforms  平台共享账号（baseUrl + apiKey 默认存放处）
 *   model_channels 平台 × 逻辑模型 × 协议 的渠道实例
 *
 * 查询逻辑：
 * 1. join model_channels + ai_platforms，WHERE modelSlug = ? AND 渠道/平台均 isActive = true
 *    ORDER BY channel.priority
 * 2. config 合并：平台 baseUrl/apiKey 为默认值，渠道 config（仅 baseUrl/apiKey）覆盖
 * 3. 无记录 → 返回空列表，由任务执行层给出明确错误
 *
 * 二级 key 解析（最终在 TaskExecutionService 合并渠道覆盖）：
 *   渠道 config.apiKey（覆盖平台默认）> 平台 apiKey > 显性报错（模型不参与 key 配置）
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { aiPlatforms, modelChannels } from '../../db/schema/gateway';
import { and, asc, eq } from 'drizzle-orm';

// ===== Types =====

export interface ProviderInstance {
  channelId: string;
  platformId: string;
  platformName: string;
  sdkModelId: string;
  sdkClient: string;
  priority: number;
  costPerCall: number | null;
  costPerSecond: number | null;
  /** 已合并的渠道配置：{...平台默认, ...渠道覆盖}，仅含 baseUrl/apiKey */
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
   * 查询模型的所有可用渠道（平台默认配置 + 渠道覆盖合并），按优先级排序
   *
   * @param modelSlug 模型 slug
   * @returns 按优先级排序的 ProviderInstance 列表
   */
  async getAvailableProviders(
    modelSlug: string,
  ): Promise<ProviderInstance[]> {
    try {
      const rows = await this.db
        .select({
          channel: modelChannels,
          platformName: aiPlatforms.name,
          platformBaseUrl: aiPlatforms.baseUrl,
          platformApiKey: aiPlatforms.apiKey,
        })
        .from(modelChannels)
        .innerJoin(aiPlatforms, eq(modelChannels.platformId, aiPlatforms.id))
        .where(and(
          eq(modelChannels.modelSlug, modelSlug),
          eq(modelChannels.isActive, true),
          eq(aiPlatforms.isActive, true),
        ))
        .orderBy(asc(modelChannels.priority), asc(modelChannels.createdAt));

      if (rows.length > 0) {
        return rows.map((r) => ({
          channelId: r.channel.id,
          platformId: r.channel.platformId,
          platformName: r.platformName,
          sdkModelId: r.channel.sdkModelId,
          sdkClient: r.channel.sdkClient,
          priority: r.channel.priority,
          costPerCall: r.channel.costPerCall ? parseFloat(r.channel.costPerCall) : null,
          costPerSecond: r.channel.costPerSecond ? parseFloat(r.channel.costPerSecond) : null,
          // 平台默认（baseUrl/apiKey）→ 渠道 config 覆盖
          config: {
            ...(r.platformBaseUrl ? { baseUrl: r.platformBaseUrl } : {}),
            ...(r.platformApiKey ? { apiKey: r.platformApiKey } : {}),
            ...((r.channel.config as Record<string, unknown>) || {}),
          },
        }));
      }
    } catch (e) {
      this.logger.warn(
        `Failed to query modelChannels for "${modelSlug}": ${(e as Error).message}`,
      );
      return [];
    }

    return [];
  }
}
