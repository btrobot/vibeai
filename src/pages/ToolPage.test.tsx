import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToolPage from './ToolPage';

function renderToolPage(toolType: string) {
  const toolRoutes: Record<string, string> = {
    'detail-page': 'detail-page',
    'invalid-tool': 'invalid-tool',
    'background-removal': 'background-removal',
    'scene-composition': 'scene-composition',
    'model-dressing': 'model-dressing',
  };
  const route = toolRoutes[toolType] ?? toolType;
  return render(
    <MemoryRouter initialEntries={[`/tools/${route}`]}>
      <Routes>
        <Route path="/tools/detail-page" element={<ToolPage toolSlug="detail-page" />} />
        <Route path="/tools/:toolType" element={<ToolPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ToolPage', () => {
  beforeEach(() => {
    localStorage.setItem('auth_tokens', JSON.stringify({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('渲染白底图生成工具（/tools/background-removal）', () => {
    renderToolPage('background-removal');
    expect(screen.getByText('白底图生成')).toBeInTheDocument();
    expect(screen.getByText('一键去除商品背景，生成纯白底图，支持批量处理')).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
  });

  it('渲染场景合成工具（/tools/scene-composition）', () => {
    renderToolPage('scene-composition');
    expect(screen.getByText('场景合成')).toBeInTheDocument();
    expect(screen.getByText('将商品智能融入各类场景，生成自然逼真的场景图')).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
  });

  it('渲染模特换装工具（/tools/model-dressing）', () => {
    renderToolPage('model-dressing');
    expect(screen.getByText('模特换装')).toBeInTheDocument();
    expect(screen.getByText('AI 虚拟模特换装，快速生成不同穿搭效果图')).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
  });

  it('应该渲染详情页生成工具', () => {
    renderToolPage('detail-page');
    expect(screen.getByText('详情页生成')).toBeInTheDocument();
    expect(screen.getByText('AI 自动生成商品详情页，包含文案、排版、图片')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/生成包含商品详情、规格、卖点的详情页/)).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
  });

  it('应该显示工具不存在当访问无效工具类型', () => {
    renderToolPage('invalid-tool');
    expect(screen.getByText('工具不存在')).toBeInTheDocument();
  });

  it('应该渲染上传图片区域（详情页工具）', () => {
    renderToolPage('detail-page');
    expect(screen.getByText('上传图片')).toBeInTheDocument();
    expect(screen.getByText('点击上传图片')).toBeInTheDocument();
  });

  it('应该渲染生成结果区域（详情页工具）', () => {
    renderToolPage('detail-page');
    expect(screen.getByText('生成结果')).toBeInTheDocument();
  });

  it('提交时走 /api/projects/default 获取工具箱项目（不再找/建普通项目）', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/projects/default') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { id: 'toolbox-1' } }),
        });
      }
      if (url === '/api/gateway/generate') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { taskId: 'task-1' } }),
        });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { status: 'completed', output: { content: 'done' } },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: null }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderToolPage('background-removal');
    fireEvent.change(screen.getByPlaceholderText(/去除背景，保留商品主体/), {
      target: { value: '去除背景' },
    });
    fireEvent.click(screen.getByText('开始生成'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/projects/default', expect.anything());
    });
    // 不再调用旧的"找项目/建项目"路径
    const calls = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calls.some((u: string) => u.includes('/api/projects?pageSize=1') || u === '/api/projects')).toBe(false);
    expect(screen.getByText('生成结果')).toBeInTheDocument();
  });

  it('上传参考图后 generate 请求体携带复数 referenceImages 数组（适配器消费契约）', async () => {
    const generateBodies: Array<{ input?: { referenceImages?: unknown } }> = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/projects/default') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'toolbox-1' } }) });
      }
      if (url === '/api/storage/upload') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'file-uploaded-1' } }) });
      }
      if (url === '/api/gateway/generate') {
        generateBodies.push(JSON.parse(String(init?.body)));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { taskId: 'task-1' } }) });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { status: 'completed', output: { content: 'done' } } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: null }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderToolPage('background-removal');
    fireEvent.change(screen.getByLabelText(/上传图片/), {
      target: { files: [new File(['fake-bytes'], 'product.png', { type: 'image/png' })] },
    });
    fireEvent.change(screen.getByPlaceholderText(/去除背景，保留商品主体/), {
      target: { value: '去除背景' },
    });
    fireEvent.click(screen.getByText('开始生成'));

    await waitFor(() => {
      expect(generateBodies.length).toBe(1);
    });
    const gen = generateBodies[0];
    expect(gen?.input?.referenceImages).toEqual([{ fileId: 'file-uploaded-1' }]);
    // 不再发送会被适配器忽略的单数 referenceImage
    expect((gen?.input as Record<string, unknown>)?.referenceImage).toBeUndefined();
  });
});
