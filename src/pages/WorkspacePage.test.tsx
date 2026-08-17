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
import { render, screen, waitFor } from '@testing-library/react';
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

const mockCreates = [
  { id: 'create-1', capabilitySlug: 'text-generation', prompt: 'test', sourceCreateId: null, status: 'completed', output: { text: 'ok' }, modelSlug: 'kimi-k2-5', taskCount: 1, errorMessage: null, taskStatus: 'completed', taskProgress: 100, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:01:00Z' },
  { id: 'create-2', capabilitySlug: 'image-generation', prompt: 'test2', sourceCreateId: null, status: 'processing', output: null, modelSlug: 'doubao-seedream-5-0', taskCount: 1, errorMessage: null, taskId: 'task-2', taskStatus: 'submitting', taskProgress: 45, createdAt: '2026-01-15T11:00:00Z', updatedAt: '2026-01-15T11:00:30Z' },
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
  },
  {
    slug: 'kimi-k2-5',
    name: 'Kimi K2.5',
    description: '高性能文本模型',
    costCredits: 3,
    tags: [],
    isDefault: false,
    sortOrder: 2,
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
      http.get('/api/gateway/models', () => HttpResponse.json({ success: true, data: mockModels })),
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

  it('应该渲染能力标签列表', async () => {
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
      expect(screen.getAllByText('文本生成').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('视频生成')).toBeInTheDocument();
    expect(screen.getByText('白底图')).toBeInTheDocument();
    expect(screen.getByText('场景合成')).toBeInTheDocument();
    expect(screen.getByText('模特换装')).toBeInTheDocument();
    expect(screen.getByText('详情页')).toBeInTheDocument();
  });

  it('应该切换能力标签', async () => {
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

    // 默认选中文本生成，输入框可见
    await waitFor(() => {
      expect(screen.getByText('视频生成')).toBeInTheDocument();
    });

    // 点击图像生成标签（第一个按钮元素）
    const imageButtons = screen.getAllByText('图像生成');
    await user.click(imageButtons[0]);
    // 输入框应该出现（使用 findBy 等待异步渲染）
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
      expect(screen.getByText('视频生成')).toBeInTheDocument();
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

});
