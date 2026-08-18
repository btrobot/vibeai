/**
 * E2E 夹具自建脚本（幂等）
 *
 * 保证 fresh 库上 E2E 可复现，无需手工 SQL：
 * 1. admin 用户（admin@vibeai.com / admin123456，固定 UUID + role=admin）
 * 2. 演示项目 "aa"（workspace-creation / workspace-ui 依赖）
 *
 * 依赖：后端已启动（INTEGRATION_TEST=true），DATABASE_URL 可连（server/.env）。
 * 由 e2e/global-setup.ts 自动调用。
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: false });

const ADMIN_EMAIL = 'admin@vibeai.com';
const ADMIN_PASSWORD = 'admin123456';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const API = process.env.E2E_API_URL || 'http://localhost:3001/api';

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { ok: res.ok, status: res.status, json };
}

async function ensureAdmin() {
  // 1) 尝试登录（密码可能不是固定值 → 失败走重置流程）
  let login = await api('/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (!login.ok) {
    // 2) 注册（邮箱可能已存在 → 失败则走 forgot+reset 重置密码）
    const reg = await api('/auth/register', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: '管理员' },
    });
    if (!reg.ok) {
      const forgot = await api('/auth/forgot-password', { method: 'POST', body: { email: ADMIN_EMAIL } });
      const token = forgot.json?.data?.resetToken;
      if (!token) throw new Error(`无法获取重置令牌: ${JSON.stringify(forgot.json)}`);
      const reset = await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: ADMIN_PASSWORD } });
      if (!reset.ok) throw new Error(`密码重置失败: ${JSON.stringify(reset.json)}`);
      console.log('[e2e-fixtures] admin 密码已重置为固定值');
    }
    login = await api('/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    if (!login.ok) throw new Error(`admin 登录失败: ${JSON.stringify(login.json)}`);
  }

  // 3) DB 层：固定 UUID + role=admin
  //    所有引用 users 的 FK 均为 CASCADE / SET NULL（information_schema 实测 21 列），
  //    因此 DELETE 旧用户即可级联清理全部子表，无需手动逐表删除，天然无漏删风险。
  const { Client } = require('pg');
  const dbUrl = process.env.DATABASE_URL || process.env.PGDATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL 缺失（server/.env 未加载？）');
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  try {
    const fixed = await c.query('SELECT id, email, role FROM users WHERE id=$1', [ADMIN_ID]);
    if (fixed.rows.length > 0 && fixed.rows[0].email !== ADMIN_EMAIL) {
      throw new Error(`固定 id 已被其他邮箱占用: ${fixed.rows[0].email}`);
    }
    if (fixed.rows.length === 0) {
      // 保存现有用户密码 hash（API 注册/重置已写入），删除旧用户（级联清理），以固定 id 重建
      const cur = await c.query(
        'SELECT password_hash, credits FROM users WHERE email=$1',
        [ADMIN_EMAIL]
      );
      const hash = cur.rows[0]?.password_hash;
      if (!hash) throw new Error('admin 用户不存在或缺少 password_hash（注册失败？）');
      await c.query('DELETE FROM users WHERE email=$1', [ADMIN_EMAIL]);
      await c.query(
        "INSERT INTO users (id, email, password_hash, name, role, credits, is_active, is_email_verified, created_at, updated_at) VALUES ($1,$2,$3,'管理员','admin',$4,true,true,now(),now())",
        [ADMIN_ID, ADMIN_EMAIL, hash, cur.rows[0].credits ?? 100]
      );
      console.log(`[e2e-fixtures] admin 固定: id=${ADMIN_ID} role=admin`);
    } else if (fixed.rows[0].role !== 'admin') {
      await c.query("UPDATE users SET role='admin', updated_at=now() WHERE id=$1", [ADMIN_ID]);
      console.log('[e2e-fixtures] admin role 已设为 admin');
    }
  } finally {
    await c.end();
  }

  // 4) 重新登录（UUID 变更后旧 session 已级联清理）→ 确保项目 "aa"
  login = await api('/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (!login.ok) throw new Error(`admin 重新登录失败: ${JSON.stringify(login.json)}`);
  const token = login.json?.data?.tokens?.accessToken;
  const proj = await api('/projects', { token });
  const items = proj.json?.data?.items ?? proj.json?.items ?? [];
  if (!items.some((p) => p.name === 'aa')) {
    const created = await api('/projects', {
      method: 'POST',
      token,
      body: { name: 'aa', description: 'E2E 演示项目' },
    });
    if (!created.ok) throw new Error(`项目 aa 创建失败: ${JSON.stringify(created.json)}`);
    console.log('[e2e-fixtures] 项目 aa 已创建');
  }
  // 5) 演示 create：workspace-ui 测试 1/2 依赖项目 aa 内至少一条创作卡片
  //    （旧环境靠手工残留数据，现改为 fixture 确定性自建，幂等）
  await ensureDemoCreate();
  console.log('[e2e-fixtures] 夹具就绪: admin + 项目 aa');
}

async function ensureDemoCreate() {
  const dbUrl = process.env.DATABASE_URL || process.env.PGDATABASE_URL;
  const { Client } = require('pg');
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  try {
    const proj = await c.query('SELECT id FROM projects WHERE user_id=$1 AND name=$2 LIMIT 1', [ADMIN_ID, 'aa']);
    if (proj.rows.length === 0) return; // 项目 aa 未就绪（由 ensureAdmin 保证）
    const exists = await c.query('SELECT 1 FROM creates WHERE project_id=$1 LIMIT 1', [proj.rows[0].id]);
    if (exists.rows.length === 0) {
      await c.query(
        "INSERT INTO creates (project_id, user_id, capability_slug, prompt, status, created_at, updated_at) VALUES ($1,$2,'image-generation','E2E 演示创作','completed',now(),now())",
        [proj.rows[0].id, ADMIN_ID]
      );
      console.log('[e2e-fixtures] 演示 create 已创建（workspace-ui 依赖）');
    }
  } finally {
    await c.end();
  }
}

ensureAdmin().catch((e) => {
  console.error('[e2e-fixtures] FAILED:', e.message);
  process.exit(1);
});
