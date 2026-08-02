/**
 * 数据库种子脚本
 * 使用方式：cd server && pnpm tsx scripts/seed.ts
 * 需要设置 DATABASE_URL 环境变量
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import * as schema from '../src/db/schema';

async function main() {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibeai';
  console.log('Connecting to database...');

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  console.log('Cleaning existing data...');
  await db.delete(schema.creditUsage);
  await db.delete(schema.invoices);
  await db.delete(schema.subscriptions);
  await db.delete(schema.subscriptionPlans);
  await db.delete(schema.executionStates);
  await db.delete(schema.tasks);
  await db.delete(schema.projects);
  await db.delete(schema.sessions);
  await db.delete(schema.loginLogs);
  await db.delete(schema.oauthAccounts);
  await db.delete(schema.users);

  // ========== 创建测试用户 ==========
  console.log('Creating test users...');
  const passwordHash = await bcrypt.hash('test123456', 10);
  const adminHash = await bcrypt.hash('admin123456', 10);

  const [testUser] = await db
    .insert(schema.users)
    .values({
      email: 'test@vibeai.com',
      nickname: '测试用户',
      passwordHash,
      role: 'user',
      credits: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [adminUser] = await db
    .insert(schema.users)
    .values({
      email: 'admin@vibeai.com',
      nickname: '管理员',
      passwordHash: adminHash,
      role: 'admin',
      credits: 99999,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  console.log(`  ✓ 测试用户: test@vibeai.com / test123456`);
  console.log(`  ✓ 管理员:   admin@vibeai.com / admin123456`);

  // ========== 创建套餐 ==========
  console.log('Creating subscription plans...');
  const plans = [
    {
      slug: 'free',
      name: '免费版',
      description: '适合个人体验，基本 AI 创作功能',
      price: 0,
      currency: 'CNY',
      interval: 'month' as const,
      credits: 100,
      maxProjects: 3,
      maxConcurrent: 1,
      maxStorageBytes: 104857600, // 100MB
      features: ['基础 AI 生成', '3 个项目', '1 个并发任务', '100MB 存储'],
      sortOrder: 1,
      isActive: true,
    },
    {
      slug: 'starter',
      name: '入门版',
      description: '适合个人创作者，更多额度与功能',
      price: 4900, // ¥49
      currency: 'CNY',
      interval: 'month' as const,
      credits: 500,
      maxProjects: 10,
      maxConcurrent: 3,
      maxStorageBytes: 1073741824, // 1GB
      features: ['所有 AI 生成能力', '10 个项目', '3 个并发任务', '1GB 存储', '无水印'],
      sortOrder: 2,
      isActive: true,
    },
    {
      slug: 'pro',
      name: '专业版',
      description: '适合专业创作者与小型团队',
      price: 19900, // ¥199
      currency: 'CNY',
      interval: 'month' as const,
      credits: 2000,
      maxProjects: 50,
      maxConcurrent: 10,
      maxStorageBytes: 10737418240, // 10GB
      features: ['所有 AI 生成能力', '50 个项目', '10 个并发任务', '10GB 存储', '无水印', '优先生成', 'API 访问'],
      sortOrder: 3,
      isActive: true,
    },
    {
      slug: 'enterprise',
      name: '企业版',
      description: '适合企业级用户，全功能与专属支持',
      price: 79900, // ¥799
      currency: 'CNY',
      interval: 'month' as const,
      credits: 8000,
      maxProjects: 999999,
      maxConcurrent: 30,
      maxStorageBytes: 107374182400, // 100GB
      features: ['所有 AI 生成能力', '不限项目', '30 个并发任务', '100GB 存储', '无水印', '优先生成', 'API 访问', '专属支持'],
      sortOrder: 4,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await db.insert(schema.subscriptionPlans).values(plan);
  }
  console.log(`  ✓ 已创建 ${plans.length} 个套餐`);

  // ========== 创建能力注册表 ==========
  console.log('Creating AI capabilities...');
  const capabilities = [
    {
      slug: 'text-generation',
      name: '文本生成',
      description: '商品文案、详情页文案、营销文案等文本内容生成',
      category: 'text',
      icon: 'file-text',
      sortOrder: 1,
      isActive: true,
    },
    {
      slug: 'image-generation',
      name: '图像生成',
      description: '商品主图、场景图、素材图等 AI 图像生成',
      category: 'image',
      icon: 'image',
      sortOrder: 2,
      isActive: true,
    },
    {
      slug: 'video-generation',
      name: '视频生成',
      description: '商品展示视频、广告视频等 AI 视频生成',
      category: 'video',
      icon: 'video',
      sortOrder: 3,
      isActive: true,
    },
    {
      slug: 'image-editing',
      name: '图像编辑',
      description: '基于图片的 AI 编辑与优化',
      category: 'image',
      icon: 'wand',
      sortOrder: 4,
      isActive: true,
    },
    {
      slug: 'background-removal',
      name: '白底图生成',
      description: '商品白底图、去背景，电商详情页必备',
      category: 'ecommerce',
      icon: 'image-minus',
      sortOrder: 5,
      isActive: true,
    },
    {
      slug: 'scene-composition',
      name: '场景合成',
      description: '将商品智能合成到各种场景中，生成自然场景图',
      category: 'ecommerce',
      icon: 'layers',
      sortOrder: 6,
      isActive: true,
    },
    {
      slug: 'model-dressing',
      name: '模特换装',
      description: 'AI 虚拟模特换装，真人模特替换服装',
      category: 'ecommerce',
      icon: 'shirt',
      sortOrder: 7,
      isActive: true,
    },
    {
      slug: 'detail-page-generation',
      name: '详情页生成',
      description: '自动生成商品详情页，含文案、排版、图片',
      category: 'ecommerce',
      icon: 'file-text',
      sortOrder: 8,
      isActive: true,
    },
    {
      slug: 'style-cloning',
      name: '风格克隆',
      description: '视频风格迁移，将参考视频风格应用到目标视频',
      category: 'video',
      icon: 'palette',
      sortOrder: 9,
      isActive: true,
    },
  ];

  for (const cap of capabilities) {
    await db.insert(schema.aiCapabilities).values(cap);
  }
  console.log(`  ✓ 已创建 ${capabilities.length} 个 AI 能力`);

  // ========== 创建模型注册表 ==========
  console.log('Creating AI models...');
  const models = [
    {
      slug: 'doubao-seed-2-0-pro-260215',
      name: 'Doubao Seed 2.0 Pro',
      provider: '豆包',
      description: '旗舰级全能通用模型，面向复杂推理与长链路任务',
      capabilities: ['text-generation', 'detail-page-generation'],
      config: { supportsThinking: true, maxTokens: 65536 },
      inputTypes: ['text', 'image', 'video'],
      outputTypes: ['text'],
      sortOrder: 1,
      isActive: true,
    },
    {
      slug: 'doubao-seed-2-0-lite-260215',
      name: 'Doubao Seed 2.0 Lite',
      provider: '豆包',
      description: '性能与成本均衡的通用模型，适合高频生产场景',
      capabilities: ['text-generation', 'detail-page-generation'],
      config: { supportsThinking: true, maxTokens: 32768 },
      inputTypes: ['text', 'image', 'video'],
      outputTypes: ['text'],
      sortOrder: 2,
      isActive: true,
    },
    {
      slug: 'doubao-seed-2-0-mini-260215',
      name: 'Doubao Seed 2.0 Mini',
      provider: '豆包',
      description: '低时延高并发场景的轻量模型',
      capabilities: ['text-generation'],
      config: { supportsThinking: true, maxTokens: 16384 },
      inputTypes: ['text', 'image', 'video'],
      outputTypes: ['text'],
      sortOrder: 3,
      isActive: true,
    },
    {
      slug: 'kimi-k2-5-260127',
      name: 'Kimi K2.5',
      provider: '月之暗面',
      description: 'Kimi 迄今最智能的模型，Agent、代码、视觉理解全面领先',
      capabilities: ['text-generation', 'detail-page-generation'],
      config: { supportsThinking: true },
      inputTypes: ['text', 'image', 'video'],
      outputTypes: ['text'],
      sortOrder: 4,
      isActive: true,
    },
    {
      slug: 'doubao-seedream-5-0-260128',
      name: 'Doubao SeeDream 5.0',
      provider: '豆包',
      description: '最新一代图片生成模型，画质与风格控制能力领先',
      capabilities: ['image-generation', 'image-editing', 'background-removal', 'scene-composition', 'model-dressing'],
      config: { sizes: ['2K', '4K'], supportsImageToImage: true },
      inputTypes: ['text'],
      outputTypes: ['image'],
      sortOrder: 5,
      isActive: true,
    },
    {
      slug: 'doubao-seedance-1-5-pro-251215',
      name: 'Doubao Seedance 1.5 Pro',
      provider: '豆包',
      description: '专业级视频生成模型，支持文本到视频与首帧控制',
      capabilities: ['video-generation'],
      config: { maxDuration: 12, minDuration: 4, ratios: ['16:9', '9:16', '1:1'] },
      inputTypes: ['text', 'image'],
      outputTypes: ['video'],
      sortOrder: 6,
      isActive: true,
    },
  ];

  for (const model of models) {
    await db.insert(schema.aiModels).values(model);
  }
  console.log(`  ✓ 已创建 ${models.length} 个 AI 模型`);

  // ========== 创建示例项目 ==========
  console.log('Creating sample projects...');
  const sampleProjects = [
    {
      userId: testUser.id,
      name: '夏季新品衬衫系列',
      description: '夏季新品衬衫的商品主图与详情页生成',
      coverUrl: null,
      tags: ['服装', '夏季'],
      status: 'active' as const,
    },
    {
      userId: testUser.id,
      name: '运动鞋场景合成',
      description: '运动鞋在不同场景下的合成图制作',
      coverUrl: null,
      tags: ['鞋类', '场景'],
      status: 'active' as const,
    },
    {
      userId: adminUser.id,
      name: '平台测试项目',
      description: '管理员测试项目',
      coverUrl: null,
      tags: ['测试'],
      status: 'active' as const,
    },
  ];

  for (const proj of sampleProjects) {
    await db.insert(schema.projects).values(proj);
  }
  console.log(`  ✓ 已创建 ${sampleProjects.length} 个示例项目`);

  // ========== 为测试用户激活入门版订阅 ==========
  const starterPlan = plans[1];
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1);

  await db.insert(schema.subscriptions).values({
    userId: testUser.id,
    planSlug: starterPlan.slug,
    status: 'active',
    creditsTotal: starterPlan.credits,
    creditsUsed: 0,
    creditsRemaining: starterPlan.credits,
    startDate: now,
    endDate,
    autoRenew: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`  ✓ 已为测试用户激活入门版订阅`);

  // ========== 为管理员激活企业版订阅 ==========
  const enterprisePlan = plans[3];
  const adminEndDate = new Date(now);
  adminEndDate.setFullYear(adminEndDate.getFullYear() + 1);

  await db.insert(schema.subscriptions).values({
    userId: adminUser.id,
    planSlug: enterprisePlan.slug,
    status: 'active',
    creditsTotal: enterprisePlan.credits,
    creditsUsed: 0,
    creditsRemaining: enterprisePlan.credits,
    startDate: now,
    endDate: adminEndDate,
    autoRenew: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`  ✓ 已为管理员激活企业版订阅`);

  console.log('\n✅ 数据库初始化完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试账号:');
  console.log('  用户:   test@vibeai.com / test123456');
  console.log('  管理员: admin@vibeai.com / admin123456');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});