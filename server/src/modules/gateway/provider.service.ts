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
 * 3. 参数完整性过滤（GTW-024）：openai 需合并后 apiKey 非空；replicate 需进程环境
 *    REPLICATE_API_TOKEN；coze 协议（image/llm/video）需进程环境 COZE_LOOP_API_TOKEN /
 *    COZE_WORKLOAD_API_TOKEN；未知协议不过滤（由适配器自身校验）
 * 4. 过滤后为空 → 返回空列表，由任务执行层给出明确错误
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
   * 渠道参数完整性判定（GTW-024）。
   * 与各适配器的 key 消费方式保持一致，避免「必然失败」的渠道进入 fallback 列表：
   * - openai：合并后 config.apiKey 必须非空（baseUrl 有默认值，不强求）
   * - replicate：适配器构造时读进程环境 REPLICATE_API_TOKEN
   * - coze 协议（image/llm/video）：适配器构造时读 COZE_LOOP_API_TOKEN / COZE_WORKLOAD_API_TOKEN
   * - 未知协议：不过滤（保留，由适配器自身校验，避免误杀未来协议）
   */
  private isChannelConfigured(
    sdkClient: string,
    mergedConfig: Record<string, unknown>,
    env: NodeJS.ProcessEnv = process.env,
  ): boolean {
    if (sdkClient === 'openai') {
      const apiKey = mergedConfig.apiKey;
      return typeof apiKey === 'string' && apiKey.trim() !== '';
    }
    if (sdkClient === 'replicate') {
      return typeof env.REPLICATE_API_TOKEN === 'string' && env.REPLICATE_API_TOKEN.trim() !== '';
    }
    if (sdkClient === 'image' || sdkClient === 'llm' || sdkClient === 'video') {
      // 对齐 boli GatewayCredentialResolver：凭证优先来自 DB 平台/渠道配置（mergedConfig.apiKey），
      // env COZE_LOOP_API_TOKEN 仅作兜底回退。平台/渠道配好 key 后渠道即可参与执行/fallback。
      const fromConfig = typeof mergedConfig.apiKey === 'string' && mergedConfig.apiKey.trim() !== '';
      const fromEnv =
        (typeof env.COZE_LOOP_API_TOKEN === 'string' && env.COZE_LOOP_API_TOKEN.trim() !== '') ||
        (typeof env.COZE_WORKLOAD_API_TOKEN === 'string' && env.COZE_WORKLOAD_API_TOKEN.trim() !== '');
      return fromConfig || fromEnv;
    }
    return true;
  }

  /**
   * 查询模型的所有可用渠道（平台默认配置 + 渠道覆盖合并），按优先级排序。
   * 参数不完整的渠道（GTW-024）在返回前被过滤。
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
        const providers = rows
          .map((r) => ({
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
        }))
          .filter((p) => {
            const ready = this.isChannelConfigured(p.sdkClient, p.config);
            if (!ready) {
              this.logger.warn(
                `Channel "${p.channelId}" (model=${modelSlug}, sdkClient=${p.sdkClient}, platform=${p.platformName}) 参数不完整，已过滤（不参与执行/fallback）`,
              );
            }
            return ready;
          });

        if (providers.length > 0) {
          return providers;
        }
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
