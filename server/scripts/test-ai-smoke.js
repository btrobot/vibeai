/**
 * AI Provider 冒烟测试脚本
 *
 * 运行方式: pnpm build && cd server && node scripts/test-ai-smoke.js
 *
 * 行为:
 * - 无 COZE_LOOP_API_TOKEN / REPLICATE_API_TOKEN: 跳过（exit 0）
 * - 有 token: 加载编译后的 Adapter，调一次 execute() 验证返回真实结果
 *
 * 用途: 配置真实 API token 后快速验证 Provider 可达性，避免启动整个 NestJS app
 */

process.env.INTEGRATION_TEST = 'true';

const COZE_TOKEN = process.env.COZE_LOOP_API_TOKEN || process.env.COZE_WORKLOAD_API_TOKEN;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!COZE_TOKEN && !REPLICATE_TOKEN) {
  console.log('⏭️  Skipped — no AI provider tokens configured');
  console.log('   Set COZE_LOOP_API_TOKEN and/or REPLICATE_API_TOKEN to run real smoke tests');
  process.exit(0);
}

let passed = 0;
let failed = 0;
const results = [];

function log(name, status, error) {
  results.push({ name, status, error });
  if (status === 'passed') {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} — ${error}`);
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    log(name, 'passed', null);
  } catch (err) {
    log(name, 'failed', err.message);
  }
}

function makeContext(taskId) {
  return {
    taskId,
    userId: 'smoke-test',
    onProgress: (pct, msg) => console.log(`     [${pct}%] ${msg}`),
  };
}

async function smokeCoze() {
  if (!COZE_TOKEN) {
    console.log('  ⏭️  Coze: skipped (no COZE_LOOP_API_TOKEN)');
    return;
  }

  console.log('\n📋 Coze Provider Smoke Tests\n');

  const distBase = '../dist/modules/gateway/adapters';

  await runTest('ImageAdapter should generate an image', async () => {
    const { ImageAdapter } = require(`${distBase}/image.adapter.js`);
    const adapter = new ImageAdapter();
    const result = await adapter.execute(
      { prompt: 'a tiny red apple on a white background' },
      {
        slug: 'doubao-seedream-5-0',
        providerName: 'coze',
        sdkModelId: 'doubao-seedream-5-0',
        sdkClient: 'image',
        defaultParams: {},
      },
      makeContext('smoke-image'),
    );
    if (!result.output?.images?.length) throw new Error('No images in output');
    console.log(`     output: ${result.output.images.length} image(s), first url=${result.output.images[0].url?.slice(0, 60)}...`);
  });

  await runTest('LlmAdapter should generate text', async () => {
    const { LlmAdapter } = require(`${distBase}/llm.adapter.js`);
    const adapter = new LlmAdapter();
    const result = await adapter.execute(
      { prompt: 'Write a one-sentence greeting.' },
      {
        slug: 'doubao-pro-32k',
        providerName: 'coze',
        sdkModelId: 'doubao-pro-32k',
        sdkClient: 'llm',
        defaultParams: {},
      },
      makeContext('smoke-llm'),
    );
    const text = result.output?.content || result.output?.text;
    if (!text || typeof text !== 'string') throw new Error('No text in output');
    console.log(`     output: "${text.slice(0, 60)}..."`);
  });
}

async function smokeReplicate() {
  if (!REPLICATE_TOKEN) {
    console.log('  ⏭️  Replicate: skipped (no REPLICATE_API_TOKEN)');
    return;
  }

  console.log('\n📋 Replicate Provider Smoke Tests\n');

  const distBase = '../dist/modules/gateway/adapters';

  await runTest('ReplicateAdapter should run a prediction', async () => {
    const { ReplicateAdapter } = require(`${distBase}/replicate.adapter.js`);
    const adapter = new ReplicateAdapter();
    // Use flux-schnell (fast) as smoke test
    const result = await adapter.execute(
      { prompt: 'a tiny red apple on a white background' },
      {
        slug: 'flux-schnell',
        providerName: 'replicate',
        sdkModelId: 'black-forest-labs/flux-schnell',
        sdkClient: 'replicate',
        outputType: 'image',
        defaultParams: { maxWaitTime: 60 },
      },
      makeContext('smoke-replicate'),
    );
    const imgs = result.output?.images || (Array.isArray(result.output) ? result.output : null);
    if (!imgs || !imgs.length) throw new Error('No images in output');
    console.log(`     output: ${imgs.length} image(s)`);
  });
}

async function main() {
  console.log('🔥 AI Provider Smoke Tests\n');
  console.log(`Coze token: ${COZE_TOKEN ? 'configured' : 'missing'}`);
  console.log(`Replicate token: ${REPLICATE_TOKEN ? 'configured' : 'missing'}`);

  await smokeCoze();
  await smokeReplicate();

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) {
    console.log('\n❌ Failed:');
    results.filter((r) => r.status === 'failed').forEach((r) => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});