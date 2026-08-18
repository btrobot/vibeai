/**
 * WorkspacePage 组件测试
 *
 * 覆盖范围：
 * - 加载中状态
 * - 项目详情渲染
 * - 能力标签切换
 * - 创作提交
 * - 创作列表展示
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-setup';
import WorkspacePage from './WorkspacePage';

// Mock WebSocket hook — no real WS in tests
vi.mock('@/hooks/useCreateWebSocket', () => ({
  useCreateWebSocket: vi.fn(),
}));

const mockProject = {
  id: 'proj-1',
  name: '测试项目',
  description: '这是一个测试项目',
  status: 'active',
  tags: ['test', 'demo'],
  totalCreates: 2,
  completedCreates: 1,
};

// 模拟服务器真实返回（desc：最新在上）；客户端 reverse 后呈现 asc 会话流（最新在下）
const mockCreates = [
  { id: 'create-2', capabilitySlug: 'image-generation', prompt: 'test2', sourceCreateId: null, status: 'processing', output: null, modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskId: 'task-2', taskStatus: 'submitting', taskProgress: 45, createdAt: '2026-01-15T11:00:00Z', updatedAt: '2026-01-15T11:00:30Z' },
  { id: 'create-1', capabilitySlug: 'text-generation', prompt: 'test', sourceCreateId: null, status: 'completed', output: { text: 'ok' }, modelSlug: 'kimi-k2-5', taskCount: 1, errorMessage: null, taskStatus: 'completed', taskProgress: 100, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:01:00Z' },
];

const mockModels = [
  {
    slug: 'doubao-seed-2-0-pro',
    name: 'Doubao Seed 2.0 Pro',
    description: '旗舰文本模型',
    costCredits: 5,
    tags: ['featured'],
    isDefault: true,
    sortOrder: 1,
    capabilities: ['text-generation'],
    modality: 'llm',
  },
  {
    slug: 'kimi-k2-5',
    name: 'Kimi K2.5',
    description: '高性能文本模型',
    costCredits: 3,
    tags: [],
    isDefault: false,
    sortOrder: 2,
    capabilities: ['text-generation'],
    modality: 'llm',
  },
];

const mockImageModels = [
  {
    slug: 'doubao-seedream-5-0',
    name: 'Doubao SeeDream 5.0',
    description: '旗舰图像模型',
    costCredits: 10,
    tags: ['featured'],
    isDefault: true,
    sortOrder: 1,
    capabilities: ['image-generation', 'image-editing', 'background-removal', 'scene-composition', 'model-dressing'],
    modality: 'image',
  },
  {
    slug: 'gpt-image-2',
    name: 'GPT Image 2',
    description: 'OpenAI 图像模型',
    costCredits: 15,
    tags: [],
    isDefault: false,
    sortOrder: 2,
    capabilities: ['image-generation', 'image-editing'],
    modality: 'image',
  },
];

const mockVideoModels = [
  {
    slug: 'doubao-seedance-1-5-pro',
    name: 'Doubao Seedance 1.5 Pro',
    description: '专业视频模型',
    costCredits: 20,
    tags: [],
    isDefault: true,
    sortOrder: 1,
    capabilities: ['video-generation'],
    modality: 'video',
  },
  {
    slug: 'doubao-seedance-2-0',
    name: 'Doubao Seedance 2.0',
    description: '新一代视频模型（支持风格克隆）',
    costCredits: 25,
    tags: [],
    isDefault: false,
    sortOrder: 2,
    capabilities: ['video-generation', 'style-cloning'],
    modality: 'video',
  },
];

function renderWorkspace(projectId = 'proj-1') {
  localStorage.setItem('auth_tokens', JSON.stringify({
    accessToken: 'mock-token',
    refreshToken: 'mock-refresh',
  }));
  return render(
    <MemoryRouter initialEntries={[`/workspace/${projectId}`]}>
      <Routes>
        <Route path="/workspace/:projectId" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WorkspacePage', () => {
  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    const interceptedFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => interceptedFetch(
      input,
      init?.signal ? { ...init, signal: undefined } : init,
    ));
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 2, items: mockCreates })),
      http.get('/api/gateway/models', ({ request }) => {
        const url = new URL(request.url);
        const modality = url.searchParams.get('modality');
        if (modality === 'image') {
          return HttpResponse.json({ success: true, data: mockImageModels });
        }
        return HttpResponse.json({ success: true, data: mockModels });
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('应该渲染项目详情', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/projects/proj-1/creates', () =>
        HttpResponse.json({ total: 2, items: mockCreates }),
      ),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '测试项目' })).toBeInTheDocument();
    });

    expect(screen.getByText('这是一个测试项目')).toBeInTheDocument();
  });

  it('应该渲染合并后的能力标签列表（图片 Tab 合并）', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/projects/proj-1/creates', () =>
        HttpResponse.json({ total: 2, items: mockCreates }),
      ),
    );

    renderWorkspace();

    // 等待 Tab 渲染（文本生成按钮存在，可能有多个匹配，用 getAllByRole 定位 Tab 区域）
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    // 合并后只显示 4 个 Tab：文本生成、图片、视频生成、详情页
    expect(screen.getByTitle('图片')).toBeInTheDocument();
    expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    expect(screen.getByTitle('详情页')).toBeInTheDocument();
    // 白底图/场景合成/模特换装不再作为独立 Tab 出现
    expect(screen.queryByText('白底图')).not.toBeInTheDocument();
    expect(screen.queryByText('场景合成')).not.toBeInTheDocument();
    expect(screen.queryByText('模特换装')).not.toBeInTheDocument();
  });

  it('应该切换能力标签（图片 Tab）', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/projects/proj-1/creates', () =>
        HttpResponse.json({ total: 2, items: mockCreates }),
      ),
    );

    renderWorkspace();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    });

    // 点击图片 Tab
    await user.click(screen.getByTitle('图片'));
    const textarea = await screen.findByPlaceholderText(/输入提示词/);
    expect(textarea).toBeInTheDocument();
  });

  it('应该渲染创作列表', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/projects/proj-1/creates', () =>
        HttpResponse.json({ total: 2, items: mockCreates }),
      ),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    });

    // 创作状态
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('生成中...')).toBeInTheDocument();
  });

  it('已完成创作应该显示发布按钮', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/projects/proj-1/creates', () =>
        HttpResponse.json({ total: 2, items: mockCreates }),
      ),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('发布')).toBeInTheDocument();
    });
  });

  it('按服务端默认标记选择模型', async () => {
    renderWorkspace();

    const selector = await screen.findByRole('combobox', { name: '模型' });
    expect(selector).toHaveValue('doubao-seed-2-0-pro');
    expect(screen.getByText('5 积分/次')).toBeInTheDocument();
  });

  it('提交用户选择的逻辑模型 slug', async () => {
    let requestBody: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/gateway/generate', async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          data: { taskId: 'task-1', createId: 'create-3', modelSlug: 'kimi-k2-5' },
        });
      }),
    );
    renderWorkspace();
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByRole('combobox', { name: '模型' }), 'kimi-k2-5');
    await user.type(screen.getByPlaceholderText(/输入提示词/), '写一段商品文案');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(requestBody).toMatchObject({
      capabilitySlug: 'text-generation',
      modelSlug: 'kimi-k2-5',
    }));
  });

  it('模型列表为空时禁用提交', async () => {
    server.use(
      http.get('/api/gateway/models', () => HttpResponse.json({ success: true, data: [] })),
    );
    renderWorkspace();

    expect(await screen.findByText('当前能力暂无可用模型')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  });

  it('模型加载失败时不使用硬编码模型并禁用提交', async () => {
    server.use(
      http.get('/api/gateway/models', () => HttpResponse.json({ message: 'failed' }, { status: 503 })),
    );
    renderWorkspace();

    expect(await screen.findByText('模型加载失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  });

  it('生成中的创作可以取消（调用 cancel 接口）', async () => {
    let cancelCalled = false;
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 2, items: mockCreates })),
      http.post('/api/tasks/task-2/cancel', () => {
        cancelCalled = true;
        return HttpResponse.json({ success: true, data: { id: 'task-2', status: 'cancelled' } });
      }),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('生成中...')).toBeInTheDocument();
    });

    // 生成中的卡片显示取消按钮
    const cancelBtn = screen.getByRole('button', { name: /取消/ });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelCalled).toBe(true);
    });
  });


  it('创作列表按时间正序渲染（会话流：最早在上，最新在下）', async () => {
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 2, items: mockCreates })),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getAllByTestId('create-card').length).toBe(2);
    });

    const cards = screen.getAllByTestId('create-card');
    // create-1 (10:00, completed) 在上，create-2 (11:00, processing) 在下
    expect(cards[0].textContent).toContain('test');
    expect(cards[0].textContent).toContain('已完成');
    expect(cards[1].textContent).toContain('test2');
    expect(cards[1].textContent).toContain('生成中...');
  });

  it('长文本输出显示展开全文按钮，点击后可展开/收起', async () => {
    const longText = 'A'.repeat(300);
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({
        total: 1,
        items: [{
          id: 'create-long', capabilitySlug: 'text-generation', prompt: '长文测试', sourceCreateId: null,
          status: 'completed', output: { content: longText }, modelSlug: 'kimi-k2-5', taskCount: 1,
          errorMessage: null, taskStatus: 'completed', taskProgress: 100,
          createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:01:00Z',
        }],
      })),
    );

    renderWorkspace();

    const expandBtn = await screen.findByRole('button', { name: '展开全文' });
    // 默认截断（line-clamp-5 class 存在）
    expect(expandBtn).toBeInTheDocument();

    await fireEvent.click(expandBtn);
    expect(await screen.findByRole('button', { name: '收起' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '展开全文' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '收起' }));
    expect(await screen.findByRole('button', { name: '展开全文' })).toBeInTheDocument();
  });

  it('短文本不显示展开按钮', async () => {
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 2, items: mockCreates })),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getAllByTestId('create-card').length).toBe(2);
    });

    expect(screen.queryByRole('button', { name: '展开全文' })).not.toBeInTheDocument();
  });

  it('滚动离开底部时显示回到最新按钮，点击后回到底部', async () => {
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 2, items: mockCreates })),
    );

    renderWorkspace();

    const listEl = await screen.findByTestId('create-list');
    expect(screen.queryByRole('button', { name: /回到最新/ })).not.toBeInTheDocument();

    // 模拟用户向上滚动：scrollHeight 远大于 clientHeight
    Object.defineProperty(listEl, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(listEl, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(listEl, 'scrollTop', { value: 200, configurable: true });
    fireEvent.scroll(listEl);

    expect(screen.getByRole('button', { name: /回到最新/ })).toBeInTheDocument();

    // 回到底部后按钮消失
    Object.defineProperty(listEl, 'scrollTop', { value: 1600, configurable: true });
    fireEvent.scroll(listEl);
    expect(screen.queryByRole('button', { name: /回到最新/ })).not.toBeInTheDocument();
  });


  it('按天分组：今天在前，昨日在后的卡片顺序保持会话流', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const today = new Date().toISOString();
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({
        total: 2,
        items: [
          { id: 'c-today', capabilitySlug: 'text-generation', prompt: 'today-prompt', sourceCreateId: null, status: 'completed', output: { text: 'ok' }, modelSlug: 'kimi-k2-5', taskCount: 1, errorMessage: null, taskStatus: 'completed', taskProgress: 100, createdAt: today, updatedAt: today },
          { id: 'c-yesterday', capabilitySlug: 'text-generation', prompt: 'yesterday-prompt', sourceCreateId: null, status: 'completed', output: { text: 'ok' }, modelSlug: 'kimi-k2-5', taskCount: 1, errorMessage: null, taskStatus: 'completed', taskProgress: 100, createdAt: yesterday, updatedAt: yesterday },
        ],
      })),
    );

    renderWorkspace();

    const todayGroup = await screen.findByText('今天');
    expect(todayGroup).toBeInTheDocument();
    expect(screen.getByText('昨天')).toBeInTheDocument();
    // 会话流：今天（最新）在下方 —— 昨天组在上
    expect(screen.getByText('昨天').compareDocumentPosition(screen.getByText('今天')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('点击分组头折叠/展开该组卡片', async () => {
    const today = new Date().toISOString();
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({
        total: 2,
        items: [
          { id: 'c1', capabilitySlug: 'text-generation', prompt: 'a', sourceCreateId: null, status: 'completed', output: { text: 'ok' }, modelSlug: 'kimi-k2-5', taskCount: 1, errorMessage: null, taskStatus: 'completed', taskProgress: 100, createdAt: today, updatedAt: today },
          { id: 'c2', capabilitySlug: 'image-generation', prompt: 'b', sourceCreateId: null, status: 'completed', output: null, modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskStatus: 'completed', taskProgress: 100, createdAt: new Date(Date.now() - 60000).toISOString(), updatedAt: today },
        ],
      })),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getAllByTestId('create-card').length).toBe(2);
    });

    // 点击"今天"分组头折叠
    const todayBtn = screen.getByRole('button', { name: /今天/ });
    await fireEvent.click(todayBtn);

    // 卡片全部隐藏（组内）
    expect(screen.queryAllByTestId('create-card').length).toBe(0);

    // 再点恢复
    await fireEvent.click(todayBtn);
    expect(screen.getAllByTestId('create-card').length).toBe(2);
  });

  it('有生成中任务时显示 LiveBar，点击"查看"滚动到该卡片', async () => {
    // mockCreates 含 create-2 processing
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 2, items: mockCreates })),
    );

    renderWorkspace();

    const liveBar = await screen.findByText(/1 个任务生成中/);
    expect(liveBar).toBeInTheDocument();

    const viewBtn = screen.getByRole('button', { name: '查看' });
    expect(viewBtn).toBeInTheDocument();
  });

  it('图片输出以缩略图网格渲染，点击打开灯箱并关闭', async () => {
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({
        total: 1,
        items: [{
          id: 'c-img', capabilitySlug: 'image-generation', prompt: '图', sourceCreateId: null,
          status: 'completed', output: { images: [{ url: 'https://example.com/a.png' }, { url: 'https://example.com/b.png' }] },
          modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskStatus: 'completed',
          taskProgress: 100, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:01:00Z',
        }],
      })),
    );

    renderWorkspace();

    const gridImgs = await screen.findAllByAltText('');
    // 2 张缩略图
    expect(gridImgs.length).toBe(2);

    // 点击第一张进入灯箱
    await fireEvent.click(gridImgs[0].closest('button') as HTMLElement);
    const lightboxImg = await screen.findAllByAltText('放大查看');
    expect(lightboxImg.length).toBe(1);

    // 关闭
    await fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByAltText('放大查看')).not.toBeInTheDocument();
  });


  it('基于此修改时恢复参考图', async () => {
    let storageCalled = false;
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({
        total: 1,
        items: [{
          id: 'c-ref', capabilitySlug: 'image-generation', prompt: '测试图', sourceCreateId: null,
          status: 'completed', output: { images: [{ url: 'https://example.com/a.png' }] },
          input: { prompt: '测试图', referenceImage: { fileId: 'file-uuid-123' } },
          modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskStatus: 'completed',
          taskProgress: 100, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:01:00Z',
        }],
      })),
      http.get('/api/storage/files/file-uuid-123', () => {
        storageCalled = true;
        return HttpResponse.json({ id: 'file-uuid-123', url: 'https://example.com/ref.png', originalName: 'ref.png' });
      }),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('测试图')).toBeInTheDocument();
    });

    const modifyBtn = screen.getByRole('button', { name: /基于此修改/ });
    await fireEvent.click(modifyBtn);

    await waitFor(() => {
      expect(storageCalled).toBe(true);
    });
    // 上传文件预览应出现
    expect(await screen.findByLabelText(/^移除参考图/)).toBeInTheDocument();
  });

  it('基于此修改无参考图时不调用存储 API', async () => {
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 2, items: mockCreates })),
    );

    const storageSpy = vi.fn();
    server.events.on('request:start', (req) => {
      if (req.request.url.includes('/api/storage/files/')) storageSpy();
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getAllByTestId('create-card').length).toBe(2);
    });

    // create-1 (completed, text-generation) — 无参考图
    const modifyBtns = screen.getAllByRole('button', { name: /基于此修改/ });
    await fireEvent.click(modifyBtns[0]);

    // 等异步处理完成
    await new Promise((r) => setTimeout(r, 100));
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it('图片 Tab：无参考图时自动路由到图像生成', async () => {
    let postedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/gateway/generate', async ({ request }) => {
        postedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { taskId: 't1', createId: 'c1' } });
      }),
    );

    renderWorkspace();
    const user = userEvent.setup();

    // 等待加载完成，Tab 可见
    await waitFor(() => {
      expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    });

    // 切到图片 Tab
    await user.click(screen.getByTitle('图片'));
    // 等图片模型加载 + 输入框出现
    const textarea = await screen.findByPlaceholderText(/输入提示词/);
    // 输入图片提示词，无参考图
    await user.type(textarea, '一只猫');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(postedBody).toMatchObject({ capabilitySlug: 'image-generation' });
    });
  });

  it('图片 Tab：基于此修改的图片创作能力对齐快照（不因 prompt 关键词漂移）', async () => {
    let postedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/gateway/generate', async ({ request }) => {
        postedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { taskId: 't1', createId: 'c1' } });
      }),
      http.get('/api/storage/files/file-uuid-123', () => HttpResponse.json({ id: 'file-uuid-123', url: 'https://example.com/ref.png', originalName: 'ref.png' })),
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({
        total: 1,
        items: [{
          id: 'c-img-ref', capabilitySlug: 'image-generation', prompt: '给模特换装成红色裙子', sourceCreateId: null,
          status: 'completed', output: { images: [{ url: 'https://example.com/a.png' }] },
          input: { prompt: '给模特换装成红色裙子', referenceImage: { fileId: 'file-uuid-123' } },
          modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskStatus: 'completed',
          taskProgress: 100, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:01:00Z',
        }],
      })),
    );

    renderWorkspace();
    const user = userEvent.setup();

    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText('给模特换装成红色裙子')).toBeInTheDocument();
    });

    // 点击"基于此修改" → 触发 handleModify
    await user.click(screen.getByRole('button', { name: /基于此修改/ }));
    await new Promise((r) => setTimeout(r, 300));

    // 提交：能力对齐快照 image-generation（修改 = 延续原意图；需要换装可在能力选择器手动切换）
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(postedBody).toMatchObject({ capabilitySlug: 'image-generation' });
    });
  });

  it('图片 Tab 上传多张参考图后提交 referenceImages 数组（无图时 omit）', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let uploadSeq = 0;
    server.use(
      http.post('/api/gateway/generate', async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { createId: 'create-3', modelSlug: 'doubao-seedream-5-0' } });
      }),
      http.post('/api/storage/upload', () => HttpResponse.json({
        success: true,
        data: { id: `uploaded-${++uploadSeq}` },
      })),
    );
    renderWorkspace();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('图片'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]);

    // 上传完成后堆叠出现两张卡
    await waitFor(() => {
      expect(screen.getByLabelText('移除参考图 1')).toBeInTheDocument();
      expect(screen.getByLabelText('移除参考图 2')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入提示词/), '根据两张参考图生成');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(requestBody).toBeTruthy();
      const input = (requestBody as { input: Record<string, unknown> }).input;
      expect(input.referenceImages).toEqual([{ fileId: 'uploaded-1' }, { fileId: 'uploaded-2' }]);
      expect(input.referenceImage).toBeUndefined();
    });
  });

  it('无参考图时提交 body 不含 referenceImages/referenceImage key', async () => {
    let requestBody: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/gateway/generate', async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { createId: 'create-3', modelSlug: 'kimi-k2-5' } });
      }),
    );
    renderWorkspace();
    const user = userEvent.setup();

    await user.type(await screen.findByPlaceholderText(/输入提示词/), '纯文字生成');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(requestBody).toBeTruthy();
      const input = (requestBody as { input: Record<string, unknown> }).input;
      expect(input.referenceImages).toBeUndefined();
      expect(input.referenceImage).toBeUndefined();
    });
  });

  it('超过 9 张累计上限时截断并提示', async () => {
    server.use(
      http.post('/api/storage/upload', () => HttpResponse.json({ success: true, data: { id: 'uploaded-x' } })),
    );
    renderWorkspace();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('图片'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // 先传 3 张（剩余容量 6）
    await user.upload(fileInput, [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
      new File(['c'], 'c.png', { type: 'image/png' }),
    ]);
    await waitFor(() => {
      expect(screen.getByLabelText('移除参考图 3')).toBeInTheDocument();
    });
    // 再选 8 张 → 仅补足至 9（保留 6 张）
    await user.upload(fileInput, Array.from({ length: 8 }, (_, i) =>
      new File([`f${i}`], `f${i}.png`, { type: 'image/png' }),
    ));
    // 最终 9 张（原 3 + 补 6），不出现第 10 张
    await waitFor(() => {
      expect(screen.getByLabelText('移除参考图 9')).toBeInTheDocument();
      expect(screen.queryByLabelText('移除参考图 10')).not.toBeInTheDocument();
    });
  });

  it('移除单张参考图不影响其余，且 revoke 该张 URL', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    let uploadSeq = 0;
    server.use(
      http.post('/api/storage/upload', () => HttpResponse.json({ success: true, data: { id: `uploaded-${++uploadSeq}` } })),
    );
    renderWorkspace();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('图片'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]);
    await waitFor(() => {
      expect(screen.getByLabelText('移除参考图 2')).toBeInTheDocument();
    });

    // 移除第 1 张（hover 后点击移除按钮）
    const remove1 = screen.getByLabelText('移除参考图 1');
    fireEvent.mouseEnter(screen.getAllByRole('img')[0].closest('.group') as HTMLElement);
    fireEvent.click(remove1);
    await waitFor(() => {
      expect(revokeSpy).toHaveBeenCalled();
    });
    // 移除后剩 1 张卡（剩余卡片重新编号为「移除参考图 1」）
    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(1);
      expect(screen.getByLabelText('移除参考图 1')).toBeInTheDocument();
    });
  });

  it('清空全部 revoke 所有 URL 并回到空态', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    let uploadSeq = 0;
    server.use(
      http.post('/api/storage/upload', () => HttpResponse.json({ success: true, data: { id: `uploaded-${++uploadSeq}` } })),
    );
    renderWorkspace();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('图片'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]);
    await waitFor(() => {
      expect(screen.getByLabelText('移除参考图 2')).toBeInTheDocument();
    });

    // hover 容器展开 → 点清空全部
    const container = screen.getByLabelText('添加参考图').closest('.relative') as HTMLElement;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByLabelText('清空参考图'));
    await waitFor(() => {
      expect(screen.getByLabelText('上传参考图')).toBeInTheDocument();
      expect(screen.queryByLabelText(/^移除参考图/)).not.toBeInTheDocument();
    });
    // 清空 revoke 两张 blob URL
    expect(revokeSpy).toHaveBeenCalledTimes(2);
  });

  it('多图快照（服务端已注入 url）基于此修改恢复全部参考图且不触发按需 GET', async () => {
    let storageGets = 0;
    server.use(
      http.get('/api/projects/proj-1', () => HttpResponse.json(mockProject)),
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({
        total: 1,
        items: [{
          id: 'c-ref', capabilitySlug: 'image-generation', prompt: '多图测试', sourceCreateId: null,
          status: 'completed', output: { images: [{ url: 'https://example.com/a.png' }] },
          input: {
            prompt: '多图测试',
            referenceImages: [
              { fileId: 'file-a', url: 'https://example.com/ref1.png' },
              { fileId: 'file-b', url: 'https://example.com/ref2.png' },
            ],
          },
          modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskStatus: 'completed',
          taskProgress: 100, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:01:00Z',
        }],
      })),
      http.get('/api/storage/files/:id', () => {
        storageGets += 1;
        return HttpResponse.json({ id: 'x', url: 'https://example.com/x.png', originalName: 'x.png' });
      }),
    );

    renderWorkspace();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('多图测试')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /基于此修改/ }));

    await waitFor(() => {
      expect(screen.getByLabelText('移除参考图 1')).toBeInTheDocument();
      expect(screen.getByLabelText('移除参考图 2')).toBeInTheDocument();
    });
    // 快照含 url：不应触发按需 GET
    expect(storageGets).toBe(0);
  });

  it('上传中切换 tab：in-flight 上传不落地错 tab 图片', async () => {
    let resolveUpload: (() => void) | undefined;
    server.use(
      http.post('/api/storage/upload', () => new Promise((resolve) => {
        resolveUpload = () => resolve(HttpResponse.json({ success: true, data: { id: 'uploaded-late' } }));
      })),
    );
    renderWorkspace();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTitle('视频生成')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('图片'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // 触发上传（挂起）
    const uploadPromise = user.upload(fileInput, [new File(['a'], 'a.png', { type: 'image/png' })]);
    // 等待上传请求发出（挂起中）
    await new Promise((r) => setTimeout(r, 50));
    // 切到视频 tab（清空 + 中止上传）
    await user.click(screen.getByTitle('视频生成'));
    // 放行 in-flight 上传
    resolveUpload?.();
    await uploadPromise;

    // 切回图片 tab：应回到空态（无残留堆叠）
    await user.click(screen.getByTitle('图片'));
    await waitFor(() => {
      expect(screen.getByLabelText('上传参考图')).toBeInTheDocument();
      expect(screen.queryByLabelText(/^移除参考图/)).not.toBeInTheDocument();
    });
  });
  // ===== 能力显式选择 + 参考图槽位 role（对齐 runninghub 心智） =====

  it('手动选择图片能力后模型列表按 capability 过滤（能力-模型强绑定）', async () => {
    let requestedUrl = '';
    server.use(
      http.get('/api/gateway/models', ({ request }) => {
        requestedUrl = request.url;
        const capability = new URL(request.url).searchParams.get('capability');
        if (capability === 'model-dressing') {
          return HttpResponse.json({ success: true, data: mockImageModels.filter((m) => m.capabilities.includes('model-dressing')) });
        }
        return HttpResponse.json({ success: true, data: mockModels });
      }),
    );

    renderWorkspace();
    const user = userEvent.setup();
    await waitFor(() => { expect(screen.getByTitle('视频生成')).toBeInTheDocument(); });
    await user.click(screen.getByTitle('图片'));

    // 默认自动识别：modality=image 拉全量图片模型
    await waitFor(() => {
      expect(requestedUrl).toContain('modality=image');
    });

    // 手动选择"模特换装"
    const capSelect = await screen.findByRole('combobox', { name: '图片能力' });
    await user.selectOptions(capSelect, 'model-dressing');

    await waitFor(() => {
      expect(requestedUrl).toContain('capability=model-dressing');
    });
    // 模型列表收敛为支持该能力的模型（gpt-image-2 不支持 model-dressing，被过滤）
    const modelSelect = await screen.findByRole('combobox', { name: '模型' });
    await waitFor(() => {
      expect(modelSelect).toHaveValue('doubao-seedream-5-0');
    });
  });

  it('手动选能力（模特换装）上传参考图按槽位分配 role 提交', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let uploadSeq = 0;
    server.use(
      http.get('/api/gateway/models', ({ request }) => {
        const capability = new URL(request.url).searchParams.get('capability');
        if (capability === 'model-dressing') {
          return HttpResponse.json({ success: true, data: mockImageModels.filter((m) => m.capabilities.includes('model-dressing')) });
        }
        return HttpResponse.json({ success: true, data: mockImageModels });
      }),
      http.post('/api/gateway/generate', async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { createId: 'create-3', modelSlug: 'doubao-seedream-5-0' } });
      }),
      http.post('/api/storage/upload', () => HttpResponse.json({ success: true, data: { id: `uploaded-${++uploadSeq}` } })),
    );

    renderWorkspace();
    const user = userEvent.setup();
    await waitFor(() => { expect(screen.getByTitle('视频生成')).toBeInTheDocument(); });
    await user.click(screen.getByTitle('图片'));

    const capSelect = await screen.findByRole('combobox', { name: '图片能力' });
    await user.selectOptions(capSelect, 'model-dressing');

    // 槽位提示：第 1 张模特图 + 第 2 张衣服图（能力选择器旁摘要 + 组件标签）
    await waitFor(() => {
      expect(screen.getByText('模特图 + 衣服图')).toBeInTheDocument();
    });
    // 两个角色槽位（空态）
    expect(screen.getByLabelText('模特图（点击上传）')).toBeInTheDocument();
    expect(screen.getByLabelText('衣服图（点击上传）')).toBeInTheDocument();

    // 点击模特图槽位上传第 1 张（pendingRole=model）
    await user.click(screen.getByLabelText('模特图（点击上传）'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['a'], 'a.png', { type: 'image/png' }));
    await waitFor(() => {
      expect(screen.getByLabelText('模特图（已上传，点击替换）')).toBeInTheDocument();
    });

    // 点击衣服图槽位上传第 2 张（pendingRole=garment）
    await user.click(screen.getByLabelText('衣服图（点击上传）'));
    await user.upload(fileInput, new File(['b'], 'b.png', { type: 'image/png' }));
    await waitFor(() => {
      expect(screen.getByLabelText('衣服图（已上传，点击替换）')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入提示词/), '模特换上新衣服');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(requestBody).toBeTruthy();
      const input = (requestBody as { input: Record<string, unknown> }).input;
      expect(input.referenceImages).toEqual([
        { role: 'model', fileId: 'uploaded-1' },
        { role: 'garment', fileId: 'uploaded-2' },
      ]);
      expect((requestBody as { capabilitySlug: string }).capabilitySlug).toBe('model-dressing');
    });
  });

  it('image-editing 作品发布类型为 image（P0 能力集合一致，防误判 video）', async () => {
    let postedBody: Record<string, unknown> | undefined;
    const editingWork = {
      id: 'create-edit', capabilitySlug: 'image-editing', prompt: '编辑图片', sourceCreateId: null,
      status: 'completed', output: { images: [{ url: 'https://img.example/edit.png' }] },
      modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskStatus: 'completed',
      taskProgress: 100, createdAt: '2026-01-15T12:00:00Z', updatedAt: '2026-01-15T12:00:30Z',
    };
    server.use(
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 1, items: [editingWork] })),
      http.post('/api/gallery/works', async ({ request }) => {
        postedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { id: 'work-1' } });
      }),
    );

    renderWorkspace();
    const user = userEvent.setup();
    await waitFor(() => { expect(screen.getByText('发布')).toBeInTheDocument(); });
    await user.click(screen.getByText('发布'));

    await waitFor(() => {
      expect(postedBody).toBeTruthy();
      expect(postedBody).toMatchObject({ createId: 'create-edit', type: 'image' });
    });
  });

  it('槽位替换：同一角色再次上传替换旧图，不追加（每槽 1 张）', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let uploadSeq = 0;
    server.use(
      http.get('/api/gateway/models', ({ request }) => {
        const capability = new URL(request.url).searchParams.get('capability');
        if (capability === 'model-dressing') {
          return HttpResponse.json({ success: true, data: mockImageModels.filter((m) => m.capabilities.includes('model-dressing')) });
        }
        return HttpResponse.json({ success: true, data: mockImageModels });
      }),
      http.post('/api/gateway/generate', async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { createId: 'create-3', modelSlug: 'doubao-seedream-5-0' } });
      }),
      http.post('/api/storage/upload', () => HttpResponse.json({ success: true, data: { id: `uploaded-${++uploadSeq}` } })),
    );

    renderWorkspace();
    const user = userEvent.setup();
    await waitFor(() => { expect(screen.getByTitle('视频生成')).toBeInTheDocument(); });
    await user.click(screen.getByTitle('图片'));

    const capSelect = await screen.findByRole('combobox', { name: '图片能力' });
    await user.selectOptions(capSelect, 'model-dressing');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // 第 1 次上传模特图
    await user.click(screen.getByLabelText('模特图（点击上传）'));
    await user.upload(fileInput, new File(['a'], 'a.png', { type: 'image/png' }));
    await waitFor(() => {
      expect(screen.getByLabelText('模特图（已上传，点击替换）')).toBeInTheDocument();
    });

    // 再次点击模特图槽位上传新图（替换）
    await user.click(screen.getByLabelText('模特图（已上传，点击替换）'));
    await user.upload(fileInput, new File(['a2'], 'a2.png', { type: 'image/png' }));
    await waitFor(() => {
      // 替换后该槽仍只有一张（移除旧 + 落新）
      expect(screen.getByAltText('a2.png')).toBeInTheDocument();
      expect(screen.queryByAltText('a.png')).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入提示词/), '换上新衣服');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(requestBody).toBeTruthy();
      const input = (requestBody as { input: Record<string, unknown> }).input;
      expect(input.referenceImages).toEqual([
        { role: 'model', fileId: 'uploaded-2' }, // 替换后的新图，只有一张 model
      ]);
    });
  });

  it('基于此修改：带 role 快照恢复时能力选择器对齐 + 槽位呈现', async () => {
    const dressingWork = {
      id: 'create-dress', capabilitySlug: 'model-dressing', prompt: '模特换装测试', sourceCreateId: null,
      status: 'completed', output: { images: [{ url: 'https://img.example/out.png' }] },
      modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskStatus: 'completed',
      taskProgress: 100, createdAt: '2026-01-15T13:00:00Z', updatedAt: '2026-01-15T13:00:30Z',
      input: {
        prompt: '模特换装测试',
        referenceImages: [
          { role: 'model', fileId: 'f-model', url: 'https://img.example/model.png' },
          { role: 'garment', fileId: 'f-garment', url: 'https://img.example/garment.png' },
        ],
      },
    };
    server.use(
      http.get('/api/projects/proj-1/creates', () => HttpResponse.json({ total: 1, items: [dressingWork] })),
      http.get('/api/gateway/models', ({ request }) => {
        const capability = new URL(request.url).searchParams.get('capability');
        if (capability === 'model-dressing') {
          return HttpResponse.json({ success: true, data: mockImageModels.filter((m) => m.capabilities.includes('model-dressing')) });
        }
        return HttpResponse.json({ success: true, data: mockImageModels });
      }),
    );

    renderWorkspace();
    const user = userEvent.setup();
    await waitFor(() => { expect(screen.getByText('基于此修改')).toBeInTheDocument(); });
    await user.click(screen.getByText('基于此修改'));

    // 能力选择器对齐 model-dressing
    const capSelect = await screen.findByRole('combobox', { name: '图片能力' });
    await waitFor(() => {
      expect(capSelect).toHaveValue('model-dressing');
    });
    // 槽位呈现：模特图 + 衣服图均已上传（快照 url 注入，不触发按需 GET）
    await waitFor(() => {
      expect(screen.getByLabelText('模特图（已上传，点击替换）')).toBeInTheDocument();
      expect(screen.getByLabelText('衣服图（已上传，点击替换）')).toBeInTheDocument();
    });
    // 提交时保留 role
    await user.type(screen.getByPlaceholderText(/输入提示词/), ' 换个颜色');
    let requestBody: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/gateway/generate', async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { createId: 'create-4', modelSlug: 'doubao-seedream-5-0' } });
      }),
    );
    await user.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => {
      expect(requestBody).toBeTruthy();
      const input = (requestBody as { input: Record<string, unknown> }).input;
      expect(input.referenceImages).toEqual([
        { role: 'model', fileId: 'f-model' },
        { role: 'garment', fileId: 'f-garment' },
      ]);
      expect((requestBody as { capabilitySlug: string }).capabilitySlug).toBe('model-dressing');
    });
  });

  it('视频 Tab 选风格克隆：参考视频槽上传后提交 referenceVideos（含能力过滤）', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let requestedCapability = '';
    server.use(
      http.get('/api/gateway/models', ({ request }) => {
        const capability = new URL(request.url).searchParams.get('capability');
        requestedCapability = capability ?? '';
        if (capability === 'style-cloning') {
          return HttpResponse.json({ success: true, data: [mockVideoModels.find((m) => m.slug === 'doubao-seedance-2-0')].filter(Boolean) });
        }
        return HttpResponse.json({ success: true, data: mockVideoModels });
      }),
      http.post('/api/gateway/generate', async ({ request }) => {
        requestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: { createId: 'create-v', modelSlug: 'doubao-seedance-2-0' } });
      }),
      http.post('/api/storage/upload', () => HttpResponse.json({ success: true, data: { id: 'video-1' } })),
    );

    renderWorkspace();
    const user = userEvent.setup();
    await waitFor(() => { expect(screen.getByTitle('视频生成')).toBeInTheDocument(); });
    await user.click(screen.getByTitle('视频生成'));

    // 默认视频 tab：capability=video-generation
    await waitFor(() => {
      expect(requestedCapability).toBe('video-generation');
    });

    // 选风格克隆 → 模型按 capability=style-cloning 过滤 + 参考视频槽出现
    const capSelect = await screen.findByRole('combobox', { name: '视频能力' });
    await user.selectOptions(capSelect, 'style-cloning');
    await waitFor(() => {
      expect(requestedCapability).toBe('style-cloning');
      expect(screen.getByLabelText('参考视频（点击上传）')).toBeInTheDocument();
    });

    // 上传参考视频
    await user.click(screen.getByLabelText('参考视频（点击上传）'));
    const videoInput = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(videoInput, new File(['v'], 'style.mp4', { type: 'video/mp4' }));
    await waitFor(() => {
      expect(screen.getByLabelText('参考视频（已上传，点击替换）')).toBeInTheDocument();
    });

    // 提交：capabilitySlug=style-cloning + referenceVideos 契约
    await user.type(screen.getByPlaceholderText(/输入提示词/), '克隆这个视频的风格');
    await user.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => {
      expect(requestBody).toBeTruthy();
      expect((requestBody as { capabilitySlug: string }).capabilitySlug).toBe('style-cloning');
      const input = (requestBody as { input: Record<string, unknown> }).input;
      expect(input.referenceVideos).toEqual([{ fileId: 'video-1' }]);
    });
  });
});
