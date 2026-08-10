import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from './drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import { sql } from 'drizzle-orm';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    storage: ServiceHealth;
    aiProviders: AiProvidersHealth;
  };
}

interface ServiceHealth {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

export interface AiProvidersHealth {
  coze: ProviderHealth;
  replicate: ProviderHealth;
}

interface ProviderHealth {
  status: 'mock' | 'up' | 'down';
  latency?: number;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    const [dbHealth, aiProviders] = await Promise.all([
      this.checkDatabase(),
      Promise.resolve(this.checkAiProviders()),
    ]);

    const storageHealth = this.checkStorage();

    const anyAiDown = aiProviders.coze.status === 'down' || aiProviders.replicate.status === 'down';
    const allUp = dbHealth.status === 'up' && storageHealth.status === 'up' && !anyAiDown;
    const anyDown = dbHealth.status === 'down' || storageHealth.status === 'down' || anyAiDown;

    return {
      status: anyDown ? 'down' : allUp ? 'ok' : 'degraded',
      timestamp,
      uptime,
      services: {
        database: dbHealth,
        storage: storageHealth,
        aiProviders,
      },
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    try {
      const start = Date.now();
      await this.db.execute(sql`SELECT 1`);
      const latency = Date.now() - start;
      return { status: 'up', latency };
    } catch (err) {
      this.logger.error(`Database health check failed: ${(err as Error).message}`);
      return { status: 'down', error: (err as Error).message };
    }
  }

  private checkStorage(): ServiceHealth {
    const provider = process.env.STORAGE_PROVIDER || process.env.STORAGE_TYPE || 'local';

    if (provider === 'local') {
      // Local storage — always available if the process is running
      return { status: 'up' };
    }

    // S3 storage — check if env vars are configured
    const endpoint = process.env.S3_ENDPOINT_URL || process.env.COZE_BUCKET_ENDPOINT_URL;
    const bucket = process.env.S3_BUCKET_NAME || process.env.COZE_BUCKET_NAME;

    if (!endpoint || !bucket) {
      return { status: 'down', error: 'S3 storage not configured (missing endpoint or bucket)' };
    }

    return { status: 'up' };
  }

  private checkAiProviders(): AiProvidersHealth {
    return {
      coze: this.checkProvider({
        tokenEnv: 'COZE_LOOP_API_TOKEN',
        baseUrlEnv: 'COZE_LOOP_BASE_URL',
        defaultBaseUrl: 'https://api.coze.cn',
      }),
      replicate: this.checkProvider({
        tokenEnv: 'REPLICATE_API_TOKEN',
        baseUrlEnv: 'REPLICATE_BASE_URL',
        defaultBaseUrl: 'https://api.replicate.com',
      }),
    };
  }

  private checkProvider(opts: {
    tokenEnv: string;
    baseUrlEnv: string;
    defaultBaseUrl: string;
  }): ProviderHealth {
    const token = process.env[opts.tokenEnv];
    if (!token) {
      return { status: 'mock' };
    }
    // Token present — report as up without blocking on a network ping.
    // Deep ping is done by test-ai-smoke.js, not on every health check.
    return { status: 'up' };
  }
}
