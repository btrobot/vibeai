/**
 * Standalone Seed Script
 *
 * Seeds AI models and subscription plans into the database.
 * Idempotent: skips if data already exists.
 *
 * Usage:
 *   pnpm seed              # via package.json script (tsx)
 *   npx tsx scripts/seed.ts
 *   node dist/scripts/seed.js  # after build
 *
 * Environment:
 *   DATABASE_URL or PGDATABASE_URL — PostgreSQL connection string
 */

import { config } from 'dotenv';
import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { inArray } from 'drizzle-orm';
import { aiModels, aiPlatforms, capabilityModelRoutes, modelChannels } from '../db/schema/gateway';
import { subscriptionPlans } from '../db/schema/billing';
import { systemSettings } from '../db/schema/content';
import { SEED_MODELS, SEED_PLATFORMS, SEED_CHANNELS, SEED_MODEL_ROUTES } from '../modules/gateway/seeds/model-seeds';

// ===== System Settings Seed (homepage + seo defaults) =====
const SEED_SYSTEM_SETTINGS: Array<{
  key: string;
  value: Record<string, unknown>;
  category: 'homepage' | 'seo';
  description: string;
}> = [
  {
    key: 'homepage.hero',
    value: {
      title: 'AI 驱动的内容创作',
      subtitle: '图片、视频、文案一站式生成',
      ctaText: '开始创作',
      ctaLink: '/register',
    },
    category: 'homepage',
    description: '首页 Hero 区块',
  },
  {
    key: 'homepage.featuredLimit',
    value: { count: 8 },
    category: 'homepage',
    description: '首页推荐作品数量',
  },
  {
    key: 'seo.default',
    value: {
      title: 'VibeAI - AI 内容创作平台',
      description: '用 AI 生成图片、视频和文案，电商创作一站式平台',
      keywords: 'AI生成,图片生成,视频生成,内容创作',
      ogImage: '/og-default.png',
    },
    category: 'seo',
    description: '默认 SEO 配置',
  },
];

// Load .env.local > .env
config({ path: path.resolve(__dirname, '..', '..', '.env.local'), override: false });
config({ path: path.resolve(__dirname, '..', '..', '.env'), override: false });

// ===== Subscription Plan Seed Data =====
// Source: specs/billing.spec.yaml → seed_data
interface PlanSeed {
  slug: string;
  name: string;
  description: string;
  credits: number;
  priceMonthly: string;
  priceYearly: string | null;
  maxProjects: number;
  maxStorageBytes: number;
  maxConcurrentTasks: number;
  capabilities: string[];
  features: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
}

const SEED_PLANS: PlanSeed[] = [
  {
    slug: 'free',
    name: '免费版',
    description: '适合个人体验，每月 100 积分',
    credits: 100,
    priceMonthly: '0',
    priceYearly: null,
    maxProjects: 5,
    maxStorageBytes: 104857600, // 100MB
    maxConcurrentTasks: 1,
    capabilities: ['text-generation', 'image-generation'],
    features: { support: 'community', watermark: true },
    isActive: true,
    sortOrder: 0,
  },
  {
    slug: 'starter',
    name: '入门版',
    description: '适合轻度创作者，每月 500 积分',
    credits: 500,
    priceMonthly: '29',
    priceYearly: '290',
    maxProjects: 20,
    maxStorageBytes: 536870912, // 512MB
    maxConcurrentTasks: 3,
    capabilities: ['text-generation', 'image-generation', 'image-editing', 'video-generation'],
    features: { support: 'email', watermark: false },
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: 'pro',
    name: '专业版',
    description: '适合专业团队，每月 2000 积分',
    credits: 2000,
    priceMonthly: '99',
    priceYearly: '990',
    maxProjects: 100,
    maxStorageBytes: 2147483648, // 2GB
    maxConcurrentTasks: 10,
    capabilities: ['text-generation', 'image-generation', 'image-editing', 'video-generation', 'detail-page-generation'],
    features: { support: 'priority', watermark: false, apiAccess: true },
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: 'enterprise',
    name: '企业版',
    description: '适合大规模企业，每月 10000 积分',
    credits: 10000,
    priceMonthly: '299',
    priceYearly: '2990',
    maxProjects: -1, // unlimited
    maxStorageBytes: 10737418240, // 10GB
    maxConcurrentTasks: 50,
    capabilities: ['text-generation', 'image-generation', 'image-editing', 'video-generation', 'detail-page-generation', 'background-removal', 'scene-composition', 'model-dressing'],
    features: { support: 'dedicated', watermark: false, apiAccess: true, sla: '99.9%' },
    isActive: true,
    sortOrder: 3,
  },
];

async function main(): Promise<void> {
  const databaseUrl = process.env.PGDATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[seed] ERROR: No DATABASE_URL or PGDATABASE_URL found in environment');
    process.exit(1);
  }

  console.log('[seed] Connecting to database...');
  const client = postgres(databaseUrl, { max: 5 });
  const db = drizzle(client);

  try {
    // ===== Seed AI Models =====
    console.log('[seed] Ensuring AI model bootstrap records...');
    for (const model of SEED_MODELS) {
      await db.insert(aiModels).values(model).onConflictDoUpdate({ target: aiModels.slug, set: { capabilities: model.capabilities } });
    }
    console.log(`[seed] Checked ${SEED_MODELS.length} AI models`);

    // ===== Seed Platforms + Channels =====
    console.log('[seed] Ensuring platform bootstrap records...');
    for (const platform of SEED_PLATFORMS) {
      await db.insert(aiPlatforms).values(platform).onConflictDoNothing({ target: aiPlatforms.name });
    }
    const platformRows = await db.select().from(aiPlatforms)
      .where(inArray(aiPlatforms.name, SEED_PLATFORMS.map((p) => p.name)));
    const platformIdByName = new Map(platformRows.map((p) => [p.name, p.id]));

    console.log('[seed] Ensuring channel bootstrap records...');
    for (const channel of SEED_CHANNELS) {
      const platformId = platformIdByName.get(channel.platformName);
      if (!platformId) continue;
      await db.insert(modelChannels).values({ ...channel, platformId }).onConflictDoNothing();
    }
    console.log(`[seed] Checked ${SEED_PLATFORMS.length} platforms / ${SEED_CHANNELS.length} channels`);

    // ===== Seed Capability Model Routes =====
    console.log('[seed] Ensuring capability route bootstrap records...');
    for (const route of SEED_MODEL_ROUTES) {
      await db.insert(capabilityModelRoutes).values(route).onConflictDoNothing();
    }
    console.log(`[seed] Checked ${SEED_MODEL_ROUTES.length} capability routes`);

    // ===== Seed Subscription Plans =====
    console.log('[seed] Checking subscription plans...');
    const existingPlans = await db.select().from(subscriptionPlans).limit(1);

    if (existingPlans.length > 0) {
      console.log(`[seed] Subscription plans already exist (${existingPlans.length}+ rows), skipping plan seed`);
    } else {
      console.log(`[seed] Seeding ${SEED_PLANS.length} subscription plans...`);
      for (const plan of SEED_PLANS) {
        await db.insert(subscriptionPlans).values(plan);
      }
      console.log(`[seed] Inserted ${SEED_PLANS.length} subscription plans`);
    }

    // ===== Seed System Settings (homepage + seo) =====
    console.log('[seed] Upserting system settings...');
    for (const setting of SEED_SYSTEM_SETTINGS) {
      await db
        .insert(systemSettings)
        .values(setting)
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: setting.value, updatedAt: new Date() },
        });
    }
    console.log(`[seed] Upserted ${SEED_SYSTEM_SETTINGS.length} system settings`);

    console.log('[seed] Done!');
  } catch (err) {
    console.error('[seed] FAILED:', (err as Error).message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
