import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * E2E globalSetup：通过 server/scripts/e2e-fixtures.cjs 自建夹具
 * （admin 固定 UUID + role + 密码，项目 "aa"），保证 fresh 库可复现。
 *
 * 前提：后端已启动（INTEGRATION_TEST=true，见 playwright.config.ts 注释）。
 */
const dirname = path.dirname(fileURLToPath(import.meta.url));

export default function globalSetup() {
  const serverDir = path.resolve(dirname, '..', 'server');
  const result = spawnSync('node', ['scripts/e2e-fixtures.cjs'], {
    cwd: serverDir,
    env: { ...process.env },
    encoding: 'utf-8',
  });
  // 夹具日志始终输出，便于排查
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`[e2e-global-setup] 夹具自建失败（exit ${result.status}）:\n${result.stderr || result.stdout}`);
  }
}
