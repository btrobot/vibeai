import { DrizzlePostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { BillingService } from '../src/modules/billing/billing.service';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibeai';

async function seedPlans() {
  console.log('🌱 开始初始化订阅套餐数据...\n');

  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  // 创建 BillingService 实例
  const billingService = new BillingService(db);

  try {
    await billingService.seedDefaultPlans();
    console.log('✅ 默认套餐初始化成功！\n');

    // 显示已创建的套餐
    const plans = await billingService.getPlans();
    console.log('📦 已创建的套餐：\n');
    plans.forEach((plan) => {
      console.log(`  • ${plan.name} (${plan.slug})`);
      console.log(`    价格: ¥${plan.priceMonthly}/月, 积分: ${plan.credits}`);
      console.log(`    描述: ${plan.description}`);
      console.log('');
    });

    await client.end();
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    await client.end();
    process.exit(1);
  }
}

seedPlans();
