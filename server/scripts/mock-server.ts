import * as http from 'http';
import * as crypto from 'crypto';

const PORT = 3001;

// ─── In-memory data ──────────────────────────────────────────────────────────
const users = new Map<string, any>();
const sessions = new Map<string, string>(); // token -> userId
const projects = new Map<string, any>();
const tasks = new Map<string, any>();
const files = new Map<string, any>();

// Seed test user
const testUserId = crypto.randomUUID();
const testUser = {
  id: testUserId,
  email: 'test@vibeai.com',
  nickname: '测试用户',
  password: hashPassword('test123456'),
  role: 'user',
  credits: 500,
  avatar_url: null,
  created_at: new Date().toISOString(),
};
users.set(testUserId, testUser);

const adminUserId = crypto.randomUUID();
const adminUser = {
  id: adminUserId,
  email: 'admin@vibeai.com',
  nickname: '管理员',
  password: hashPassword('admin123456'),
  role: 'admin',
  credits: 9999,
  avatar_url: null,
  created_at: new Date().toISOString(),
};
users.set(adminUserId, adminUser);

function hashPassword(password: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(password + 'vibeai-salt').digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// ─── Capabilities & Models ───────────────────────────────────────────────────
const capabilities = [
  { slug: 'text-generation', name: '文本生成', category: 'text', description: '商品文案、营销文案等文本内容生成', input_schema: { prompt: 'string' }, output_schema: { text: 'string' }, default_model: 'doubao-seed-2-0-pro-260215', estimated_cost: 1 },
  { slug: 'image-generation', name: '图像生成', category: 'image', description: '商品主图、场景图等 AI 图像生成', input_schema: { prompt: 'string', count: 'number' }, output_schema: { images: 'array' }, default_model: 'doubao-seedream-5-0-260128', estimated_cost: 5 },
  { slug: 'video-generation', name: '视频生成', category: 'video', description: '商品展示视频、营销视频生成', input_schema: { prompt: 'string', duration: 'number' }, output_schema: { video_url: 'string' }, default_model: 'doubao-seedance-1-5-pro-251215', estimated_cost: 20 },
  { slug: 'image-editing', name: '图像编辑', category: 'image', description: '图生图编辑与优化', input_schema: { prompt: 'string', image_url: 'string' }, output_schema: { image_url: 'string' }, default_model: 'doubao-seedream-5-0-260128', estimated_cost: 3 },
  { slug: 'background-removal', name: '白底去背', category: 'image', description: '商品白底图自动生成', input_schema: { image_url: 'string' }, output_schema: { image_url: 'string' }, default_model: 'doubao-seedream-5-0-260128', estimated_cost: 2 },
  { slug: 'scene-composition', name: '场景合成', category: 'image', description: '商品场景图智能合成', input_schema: { product_image_url: 'string', scene_prompt: 'string' }, output_schema: { image_url: 'string' }, default_model: 'doubao-seedream-5-0-260128', estimated_cost: 5 },
  { slug: 'model-dressing', name: '模特换装', category: 'image', description: 'AI 虚拟模特换装', input_schema: { model_image_url: 'string', garment_image_url: 'string' }, output_schema: { image_url: 'string' }, default_model: 'doubao-seedream-5-0-260128', estimated_cost: 8 },
  { slug: 'detail-page-generation', name: '详情页生成', category: 'text', description: '自动化商品详情页文案与布局生成', input_schema: { product_info: 'object' }, output_schema: { detail_html: 'string' }, default_model: 'kimi-k2-5-260127', estimated_cost: 3 },
  { slug: 'style-cloning', name: '风格克隆', category: 'video', description: '视频风格迁移与克隆', input_schema: { source_video_url: 'string', style_prompt: 'string' }, output_schema: { video_url: 'string' }, default_model: 'doubao-seedance-1-5-pro-251215', estimated_cost: 15 },
];

const models = [
  { slug: 'doubao-seed-2-0-pro-260215', name: 'Doubao Seed 2.0 Pro', provider: '豆包', description: '旗舰级全能通用模型', capabilities: ['text-generation', 'detail-page-generation'], inputTypes: ['text', 'image', 'video'], outputTypes: ['text'], sortOrder: 1 },
  { slug: 'doubao-seed-2-0-lite-260215', name: 'Doubao Seed 2.0 Lite', provider: '豆包', description: '性能与成本均衡', capabilities: ['text-generation', 'detail-page-generation'], inputTypes: ['text', 'image', 'video'], outputTypes: ['text'], sortOrder: 2 },
  { slug: 'doubao-seed-2-0-mini-260215', name: 'Doubao Seed 2.0 Mini', provider: '豆包', description: '低时延高并发轻量模型', capabilities: ['text-generation'], inputTypes: ['text', 'image', 'video'], outputTypes: ['text'], sortOrder: 3 },
  { slug: 'kimi-k2-5-260127', name: 'Kimi K2.5', provider: '月之暗面', description: '最智能模型，Agent/代码/视觉领先', capabilities: ['text-generation', 'detail-page-generation'], inputTypes: ['text', 'image', 'video'], outputTypes: ['text'], sortOrder: 5 },
  { slug: 'glm-5-0-260211', name: 'GLM-5', provider: '智谱', description: '面向 Agentic Engineering', capabilities: ['text-generation'], inputTypes: ['text'], outputTypes: ['text'], sortOrder: 6 },
  { slug: 'doubao-seedream-5-0-260128', name: 'Doubao SeeDream 5.0', provider: '豆包', description: '最新图片生成模型', capabilities: ['image-generation', 'image-editing', 'background-removal', 'scene-composition', 'model-dressing'], inputTypes: ['text'], outputTypes: ['image'], sortOrder: 10 },
  { slug: 'doubao-seedance-1-5-pro-251215', name: 'Doubao Seedance 1.5 Pro', provider: '豆包', description: '专业级视频生成模型', capabilities: ['video-generation', 'style-cloning'], inputTypes: ['text', 'image'], outputTypes: ['video'], sortOrder: 11 },
];

const plans = [
  { slug: 'free', name: '免费版', price: 0, credits: 100, maxProjects: 3, maxConcurrency: 1, maxStorage: 104857600, features: ['基础文本生成', '图像生成', '社区画廊'] },
  { slug: 'starter', name: '入门版', price: 4900, credits: 500, maxProjects: 10, maxConcurrency: 3, maxStorage: 1073741824, features: ['文本+图像生成', '白底去背', '场景合成', '优先队列'] },
  { slug: 'pro', name: '专业版', price: 19900, credits: 2000, maxProjects: 50, maxConcurrency: 10, maxStorage: 10737418240, features: ['全部能力', '视频生成', '模特换装', '详情页生成', 'API 访问'] },
  { slug: 'enterprise', name: '企业版', price: 79900, credits: 8000, maxProjects: 999, maxConcurrency: 30, maxStorage: 107374182400, features: ['全部能力', '风格克隆', '专线模型', 'SLA 保障', '专属客服'] },
];

// ─── Helper functions ────────────────────────────────────────────────────────
function parseJson(body: string): any {
  try { return JSON.parse(body); } catch { return {}; }
}

function getTokenFromHeaders(headers: http.IncomingHttpHeaders): string | null {
  // Check Authorization header first
  const auth = headers.authorization || '';
  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1];

  // Fallback to cookie
  const cookie = headers.cookie || '';
  const cookieMatch = cookie.match(/auth_token=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : null;
}

function getAuthUser(headers: http.IncomingHttpHeaders): any {
  const token = getTokenFromHeaders(headers);
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  return users.get(userId) || null;
}

function ok(data: any) { return { success: true, data }; }
function fail(error: string, code = 'ERROR') { return { success: false, error, code }; }

function jsonResponse(res: http.ServerResponse, data: any, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end(JSON.stringify(data));
}

function htmlResponse(res: http.ServerResponse, html: string) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// ─── Request router ──────────────────────────────────────────────────────────
function route(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  // Collect body
  let body = '';
  req.on('data', (chunk: Buffer) => body += chunk.toString());
  req.on('end', () => {
    try {
      handleRoute(method, path, url, body, req, res);
    } catch (e: any) {
      jsonResponse(res, { error: e.message }, 500);
    }
  });
}

function handleRoute(method: string, path: string, url: URL, body: string, req: http.IncomingMessage, res: http.ServerResponse): void {
  const data = parseJson(body);
  const user = getAuthUser(req.headers);

  // ══════════════════════════════════════════════════════════════════════════════
  // Auth
  // ══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/auth/register' && method === 'POST') {
    const { email, password, nickname } = data;
    if (!email || !password) return jsonResponse(res, fail('邮箱和密码必填'), 400);
    const existing = Array.from(users.values()).find(u => u.email === email);
    if (existing) return jsonResponse(res, fail('邮箱已注册'), 409);
    const id = crypto.randomUUID();
    const newUser = { id, email, nickname: nickname || email.split('@')[0], password: hashPassword(password), role: 'user', credits: 100, avatar_url: null, created_at: new Date().toISOString() };
    users.set(id, newUser);
    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    sessions.set(accessToken, id);
    sessions.set(refreshToken, id);
    return jsonResponse(res, ok({
      user: { id: newUser.id, email: newUser.email, nickname: newUser.nickname, role: newUser.role, credits: newUser.credits, avatar_url: newUser.avatar_url, created_at: newUser.created_at },
      tokens: { accessToken, refreshToken, expiresIn: 900 },
    }));
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const { email, password } = data;
    if (!email || !password) return jsonResponse(res, fail('邮箱和密码必填'), 400);
    const found = Array.from(users.values()).find(u => u.email === email);
    if (!found || !verifyPassword(password, found.password)) return jsonResponse(res, fail('邮箱或密码错误'), 401);
    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    sessions.set(accessToken, found.id);
    sessions.set(refreshToken, found.id);
    return jsonResponse(res, ok({
      user: { id: found.id, email: found.email, nickname: found.nickname, role: found.role, credits: found.credits, avatar_url: found.avatar_url, created_at: found.created_at },
      tokens: { accessToken, refreshToken, expiresIn: 900 },
    }));
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const token = getTokenFromHeaders(req.headers);
    if (token) sessions.delete(token);
    return jsonResponse(res, ok({ message: '已登出' }));
  }

  if (path === '/api/auth/me' && method === 'GET') {
    if (!user) return jsonResponse(res, fail('未登录', 'UNAUTHORIZED'), 401);
    return jsonResponse(res, ok({ id: user.id, email: user.email, nickname: user.nickname, role: user.role, credits: user.credits, avatar_url: user.avatar_url, created_at: user.created_at }));
  }

  if (path === '/api/auth/refresh' && method === 'POST') {
    const token = getTokenFromHeaders(req.headers);
    if (!token || !sessions.has(token)) return jsonResponse(res, fail('登录已过期', 'UNAUTHORIZED'), 401);
    const newToken = crypto.randomUUID();
    const userId = sessions.get(token)!;
    sessions.set(newToken, userId);
    sessions.delete(token);
    sessions.set(newToken, userId);
    return jsonResponse(res, ok({ accessToken: newToken, refreshToken: newToken, expiresIn: 900 }));
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Gateway - Capabilities & Models
  // ══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/gateway/capabilities' && method === 'GET') {
    return jsonResponse(res, ok(capabilities));
  }

  if (path.startsWith('/api/gateway/capabilities/') && path.endsWith('/models') && method === 'GET') {
    const slug = path.replace('/api/gateway/capabilities/', '').replace('/models', '');
    const cap = capabilities.find(c => c.slug === slug);
    if (!cap) return jsonResponse(res, fail('能力不存在', 'NOT_FOUND'), 404);
    const matchedModels = models.filter(m => m.capabilities.includes(slug));
    return jsonResponse(res, ok({ capability: cap, models: matchedModels }));
  }

  if (path.startsWith('/api/gateway/capabilities/') && method === 'GET') {
    const slug = path.replace('/api/gateway/capabilities/', '');
    const cap = capabilities.find(c => c.slug === slug);
    if (!cap) return jsonResponse(res, fail('能力不存在', 'NOT_FOUND'), 404);
    return jsonResponse(res, ok(cap));
  }

  if (path === '/api/gateway/models' && method === 'GET') {
    return jsonResponse(res, ok(models));
  }

  if (path === '/api/gateway/generate' && method === 'POST') {
    if (!user) return jsonResponse(res, fail('未登录', 'UNAUTHORIZED'), 401);
    const { capability_slug, prompt, model_slug, project_id, ...rest } = data;
    if (!capability_slug || !prompt) return jsonResponse(res, fail('能力标识和提示词必填', 'VALIDATION'), 400);
    const taskId = crypto.randomUUID();
    const task = {
      id: taskId, project_id: project_id || null, user_id: user.id, type: 'generation',
      status: 'queued', priority: 0, progress: 0, progress_message: '任务已创建',
      capability_slug, model_slug: model_slug || null, prompt, input: rest,
      output: null, error_message: null, credits_cost: 1,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    tasks.set(taskId, task);

    // Simulate async completion
    setTimeout(() => {
      task.status = 'processing';
      task.progress = 30;
      task.progress_message = 'AI 正在处理中...';
      task.updated_at = new Date().toISOString();
    }, 500);
    setTimeout(() => {
      task.status = 'completed';
      task.progress = 100;
      task.progress_message = '生成完成';
      task.output = { result_url: 'https://via.placeholder.com/1024', text: '这是 AI 生成的示例内容，用于演示前端效果。' };
      task.updated_at = new Date().toISOString();
    }, 2000);

    return jsonResponse(res, ok({ taskId, status: 'queued' }));
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Projects
  // ══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/projects' && method === 'GET') {
    if (!user) return jsonResponse(res, fail('未登录', 'UNAUTHORIZED'), 401);
    const userProjects = Array.from(projects.values()).filter(p => p.user_id === user.id);
    return jsonResponse(res, ok({ data: userProjects, total: userProjects.length }));
  }

  if (path === '/api/projects' && method === 'POST') {
    if (!user) return jsonResponse(res, fail('未登录', 'UNAUTHORIZED'), 401);
    const { name, description, type } = data;
    if (!name) return jsonResponse(res, fail('项目名称必填', 'VALIDATION'), 400);
    const id = crypto.randomUUID();
    const project = { id, name, description: description || '', type: type || 'general', user_id: user.id, status: 'active', tags: [], task_count: 0, completed_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    projects.set(id, project);
    return jsonResponse(res, project, 201);
  }

  if (path.startsWith('/api/projects/') && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    const id = path.replace('/api/projects/', '');
    const project = projects.get(id);
    if (!project || project.user_id !== user.id) return jsonResponse(res, { error: '项目不存在' }, 404);
    return jsonResponse(res, project);
  }

  if (path.startsWith('/api/projects/') && method === 'DELETE') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    const id = path.replace('/api/projects/', '');
    const project = projects.get(id);
    if (!project || project.user_id !== user.id) return jsonResponse(res, { error: '项目不存在' }, 404);
    projects.delete(id);
    return jsonResponse(res, { success: true });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Tasks
  // ══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/tasks' && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    const userTasks = Array.from(tasks.values()).filter(t => t.user_id === user.id);
    return jsonResponse(res, { data: userTasks, total: userTasks.length });
  }

  if (path.startsWith('/api/tasks/') && path.endsWith('/states') && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    const id = path.replace('/api/tasks/', '').replace('/states', '');
    const task = tasks.get(id);
    if (!task || task.user_id !== user.id) return jsonResponse(res, { error: '任务不存在' }, 404);
    return jsonResponse(res, { taskId: id, status: task.status, progress: task.progress, message: task.progress_message, output: task.output });
  }

  if (path.startsWith('/api/tasks/') && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    const id = path.replace('/api/tasks/', '');
    const task = tasks.get(id);
    if (!task || task.user_id !== user.id) return jsonResponse(res, { error: '任务不存在' }, 404);
    return jsonResponse(res, task);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Storage
  // ══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/storage/files' && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    const userFiles = Array.from(files.values()).filter(f => f.user_id === user.id);
    return jsonResponse(res, { data: userFiles, total: userFiles.length });
  }

  if (path === '/api/storage/upload' && method === 'POST') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    const id = crypto.randomUUID();
    const fileRecord = {
      id, user_id: user.id, original_name: 'demo-image.png', mime_type: 'image/png', size: 102400,
      category: 'image', url: 'https://via.placeholder.com/400', storage_path: `uploads/${user.id}/${id}.png`,
      width: 400, height: 400, created_at: new Date().toISOString(),
    };
    files.set(id, fileRecord);
    return jsonResponse(res, fileRecord, 201);
  }

  if (path === '/api/storage/stats' && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    const userFiles = Array.from(files.values()).filter(f => f.user_id === user.id);
    return jsonResponse(res, { totalFiles: userFiles.length, totalSize: userFiles.reduce((s, f) => s + f.size, 0), byCategory: { image: 5, video: 2, document: 1 } });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Billing
  // ══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/billing/plans' && method === 'GET') {
    return jsonResponse(res, ok(plans));
  }

  if (path === '/api/billing/subscription' && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    return jsonResponse(res, { plan: 'free', planName: '免费版', credits: user.credits, creditsUsed: 50, status: 'active', startDate: new Date().toISOString(), endDate: null });
  }

  if (path === '/api/billing/stats' && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    return jsonResponse(res, { totalCredits: user.credits, usedCredits: 50, remainingCredits: user.credits - 50, tasksThisMonth: 12, storageUsed: 52428800 });
  }

  if (path === '/api/billing/usage' && method === 'GET') {
    if (!user) return jsonResponse(res, { error: '未登录' }, 401);
    return jsonResponse(res, { data: [
      { id: '1', task_type: 'image-generation', credits_used: 5, description: '商品主图生成', created_at: new Date().toISOString() },
      { id: '2', task_type: 'text-generation', credits_used: 1, description: '文案生成', created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: '3', task_type: 'background-removal', credits_used: 2, description: '白底图去背', created_at: new Date(Date.now() - 172800000).toISOString() },
    ], total: 3 });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Fallback: serve a simple HTML page for the root
  // ══════════════════════════════════════════════════════════════════════════════
  if (path === '/api/health') {
    return jsonResponse(res, { status: 'ok', timestamp: new Date().toISOString() });
  }

  jsonResponse(res, { error: 'Not Found' }, 404);
}

const server = http.createServer(route);
server.listen(PORT, () => {
  console.log(`[Mock API] Server running on http://localhost:${PORT}`);
  console.log(`[Mock API] Test accounts:`);
  console.log(`  Admin:  admin@vibeai.com / admin123456`);
  console.log(`  User:   test@vibeai.com / test123456`);
});