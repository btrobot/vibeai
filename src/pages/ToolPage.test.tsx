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
    expect(screen.getByText('上传产品图片，一键生成纯白/自定义背景产品图')).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
  });

  it('白底图工具渲染背景色选择器（5 色对齐 boli：纯白/浅灰/银灰/纯黑/透明）', () => {
    renderToolPage('background-removal');
    expect(screen.getByText('选择背景颜色')).toBeInTheDocument();
    for (const label of ['纯白', '浅灰', '银灰', '纯黑', '透明']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('非白底图工具不渲染背景色选择器', () => {
    renderToolPage('scene-composition');
    expect(screen.queryByText('选择背景颜色')).not.toBeInTheDocument();
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
    expect(screen.getByText('开始换装')).toBeInTheDocument();
  });

  it('模特换装渲染双上传槽位 + 拍摄建议（boli 对齐 clothing-change）', () => {
    renderToolPage('model-dressing');
    expect(screen.getByText('模特图（第一张）')).toBeInTheDocument();
    expect(screen.getByText('衣服图（第二张）')).toBeInTheDocument();
    expect(screen.getByLabelText(/点击上传模特图/)).toBeInTheDocument();
    expect(screen.getByLabelText(/点击上传衣服图/)).toBeInTheDocument();
    expect(screen.getByText('模特图拍摄建议')).toBeInTheDocument();
    for (const tip of ['正面或微侧面站立姿势', '双手自然下垂或叉腰', '避免遮挡身体主要部位', '背景简洁、光线充足']) {
      expect(screen.getByText(`• ${tip}`)).toBeInTheDocument();
    }
    expect(screen.getByText('补充要求（可选）')).toBeInTheDocument();
    // 双图未齐时按钮禁用（boli 契约：模特图 + 服装图必填）
    const btn = screen.getByRole('button', { name: /开始换装/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('非模特换装工具不渲染衣服图槽位与拍摄建议', () => {
    renderToolPage('scene-composition');
    expect(screen.queryByText('衣服图（第二张）')).not.toBeInTheDocument();
    expect(screen.queryByText('模特图拍摄建议')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/点击上传衣服图/)).not.toBeInTheDocument();
  });

  it('模特换装仅上传模特图时按钮仍禁用，上传双图后可用', () => {
    renderToolPage('model-dressing');
    const btn = () => screen.getByRole('button', { name: /开始换装/ }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText(/点击上传模特图/), {
      target: { files: [new File(['fake-bytes'], 'person.png', { type: 'image/png' })] },
    });
    expect(btn().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/点击上传衣服图/), {
      target: { files: [new File(['fake-bytes'], 'garment.png', { type: 'image/png' })] },
    });
    expect(btn().disabled).toBe(false);
  });

  it('模特换装提交：双参考图按角色顺序（模特→服装）+ 固定换装 prompt（boli 对齐）', async () => {
    const generateBodies: Array<{ input?: Record<string, unknown>; capabilitySlug?: string }> = [];
    let uploadCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/projects/default') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'toolbox-1' } }) });
      }
      if (url === '/api/storage/upload') {
        // 上传顺序固定：第一次=模特图，第二次=服装图（ToolPage 顺序 await）
        uploadCount += 1;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { id: uploadCount === 1 ? 'file-person-1' : 'file-garment-1' } }),
        });
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

    renderToolPage('model-dressing');
    fireEvent.change(screen.getByLabelText(/点击上传模特图/), {
      target: { files: [new File(['fake-bytes'], 'person.png', { type: 'image/png' })] },
    });
    fireEvent.change(screen.getByLabelText(/点击上传衣服图/), {
      target: { files: [new File(['fake-bytes'], 'garment.png', { type: 'image/png' })] },
    });
    // 补充要求（可选）透传
    fireEvent.change(screen.getByPlaceholderText(/可选：描述期望的穿搭效果/), {
      target: { value: '叉腰站姿、户外街拍' },
    });
    fireEvent.click(screen.getByText('开始换装'));

    await waitFor(() => {
      expect(generateBodies.length).toBe(1);
    });
    const gen = generateBodies[0];
    const input = gen?.input ?? {};
    expect(gen?.capabilitySlug).toBe('model-dressing');
    // 双参考图：模特在前、服装在后（与 prompt 角色顺序一致）
    expect(input.referenceImages).toEqual([
      { fileId: 'file-person-1' },
      { fileId: 'file-garment-1' },
    ]);
    expect(input.referenceImage).toBeUndefined();
    expect(input.prompt).toContain('模特换装：第一张图为模特，第二张图为服装');
    expect(input.prompt).toContain('补充要求：叉腰站姿、户外街拍');
  });

  it('模特换装无补充要求时 prompt 为固定基础模板（对齐 boli prompt=模特换装）', async () => {
    const generateBodies: Array<{ input?: Record<string, unknown> }> = [];
    let uploadCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/projects/default') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'toolbox-1' } }) });
      }
      if (url === '/api/storage/upload') {
        uploadCount += 1;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { id: uploadCount === 1 ? 'file-person-1' : 'file-garment-1' } }),
        });
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

    renderToolPage('model-dressing');
    fireEvent.change(screen.getByLabelText(/点击上传模特图/), {
      target: { files: [new File(['fake-bytes'], 'person.png', { type: 'image/png' })] },
    });
    fireEvent.change(screen.getByLabelText(/点击上传衣服图/), {
      target: { files: [new File(['fake-bytes'], 'garment.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByText('开始换装'));

    await waitFor(() => {
      expect(generateBodies.length).toBe(1);
    });
    const input = generateBodies[0]?.input ?? {};
    expect(input.prompt).toBe(
      '模特换装：第一张图为模特，第二张图为服装，将服装穿到模特身上，保持模特面部和姿态不变，生成自然逼真的试穿效果图',
    );
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

  it('白底图 generate 请求体携带 backgroundColor（默认纯白 #ffffff）', async () => {
    const generateBodies: Array<{ input?: Record<string, unknown> }> = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/projects/default') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'toolbox-1' } }) });
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
    // 上传参考图（确保走 edits 路径），默认背景色纯白
    fireEvent.change(screen.getByLabelText(/上传图片/), {
      target: { files: [new File(['fake-bytes'], 'product.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByText('开始生成'));

    await waitFor(() => {
      expect(generateBodies.length).toBe(1);
    });
    expect(generateBodies[0]?.input?.backgroundColor).toBe('#ffffff');
  });

  it('选择纯黑背景后 generate 请求体携带对应 backgroundColor', async () => {
    const generateBodies: Array<{ input?: Record<string, unknown> }> = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/projects/default') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'toolbox-1' } }) });
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
    fireEvent.click(screen.getByRole('button', { name: /纯黑/ }));
    fireEvent.click(screen.getByText('开始生成'));

    await waitFor(() => {
      expect(generateBodies.length).toBe(1);
    });
    expect(generateBodies[0]?.input?.backgroundColor).toBe('#000000');
  });

  it('非白底图工具请求体不带 backgroundColor', async () => {
    const generateBodies: Array<{ input?: Record<string, unknown> }> = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/projects/default') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'toolbox-1' } }) });
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

    renderToolPage('scene-composition');
    fireEvent.change(screen.getByLabelText(/上传图片/), {
      target: { files: [new File(['fake-bytes'], 'product.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByText('开始生成'));

    await waitFor(() => {
      expect(generateBodies.length).toBe(1);
    });
    expect((generateBodies[0]?.input as Record<string, unknown>)?.backgroundColor).toBeUndefined();
  });

  it('场景合成工具渲染 8 场景模板 + 5 光影风格 + 强度 slider（boli 对齐）', () => {
    renderToolPage('scene-composition');
    expect(screen.getByText('选择场景')).toBeInTheDocument();
    for (const label of ['客厅', '厨房', '卧室', '户外', '办公', '咖啡厅', '白色影棚', '深色影棚']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByText('光影风格')).toBeInTheDocument();
    for (const label of ['摄影棚', '自然光', '戏剧光', '暖光', '冷光']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
    const slider = screen.getByLabelText('风格强度') as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.type).toBe('range');
    expect(Number(slider.min)).toBe(0.1);
    expect(Number(slider.max)).toBe(1);
    expect(Number(slider.step)).toBe(0.05);
    expect(Number(slider.value)).toBe(0.7); // 默认 0.7（boli 对齐）
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('非场景合成工具不渲染场景模板/光影/强度控件', () => {
    renderToolPage('background-removal');
    expect(screen.queryByText('选择场景')).not.toBeInTheDocument();
    expect(screen.queryByText('光影风格')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('风格强度')).not.toBeInTheDocument();
    renderToolPage('model-dressing');
    expect(screen.queryByText('选择场景')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('风格强度')).not.toBeInTheDocument();
  });

  it('场景合成提交：prompt 按 boli recipe 拼接（场景描述 + lighting + scene 模板 + 电商后缀）', async () => {
    const generateBodies: Array<{ input?: Record<string, unknown>; capabilitySlug?: string }> = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/projects/default') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'toolbox-1' } }) });
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

    renderToolPage('scene-composition');
    // 填写自定义场景描述 + 切换模板/光影/强度
    fireEvent.change(screen.getByPlaceholderText(/将商品放在自然光下的木桌上/), {
      target: { value: '把保温杯放在窗边的木桌上' },
    });
    fireEvent.click(screen.getByRole('button', { name: /厨房/ }));
    fireEvent.click(screen.getByRole('button', { name: /自然光/ }));
    fireEvent.change(screen.getByLabelText('风格强度'), { target: { value: '0.9' } });
    fireEvent.click(screen.getByText('开始生成'));

    await waitFor(() => {
      expect(generateBodies.length).toBe(1);
    });
    const gen = generateBodies[0];
    const input = gen?.input ?? {};
    expect(input.prompt).toBe(
      '把保温杯放在窗边的木桌上, natural lighting, scene: kitchen, professional product photography, high quality, detailed',
    );
    expect(input.sceneTemplate).toBe('kitchen');
    expect(input.lightingStyle).toBe('natural');
    expect(input.strength).toBe(0.9);
    expect(gen?.capabilitySlug).toBe('scene-composition');
  });

  it('场景合成无自定义描述时回退默认场景描述（boli 对齐 Place the product in a ... scene）', async () => {
    const generateBodies: Array<{ input?: Record<string, unknown> }> = [];
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

    renderToolPage('scene-composition');
    fireEvent.change(screen.getByLabelText(/上传图片/), {
      target: { files: [new File(['fake-bytes'], 'product.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByText('开始生成'));

    await waitFor(() => {
      expect(generateBodies.length).toBe(1);
    });
    const input = generateBodies[0]?.input ?? {};
    expect(input.prompt).toContain('Place the product in a living-room scene');
    expect(input.prompt).toContain('studio lighting');
    expect(input.prompt).toContain('scene: living-room');
    expect(input.prompt).toContain('professional product photography, high quality, detailed');
    // 参考图契约：复数 referenceImages（适配器消费），无单数 referenceImage
    expect(input.referenceImages).toEqual([{ fileId: 'file-uploaded-1' }]);
    expect(input.referenceImage).toBeUndefined();
  });
});
