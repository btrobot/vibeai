import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-setup';
import ModelConfigTab from './ModelConfigTab';

const configuration = {
  models: [
    {
      id: 'model-1',
      slug: 'doubao-seedream-5-0',
      name: 'Doubao SeeDream 5.0',
      modality: 'image',
      capabilities: ['image-generation'],
      description: '旗舰图片模型',
      outputType: 'image',
      costCredits: 10,
      tags: ['featured'],
      isActive: true,
      isFeatured: true,
      sortOrder: 10,
      defaultParams: { temperature: 0.7, size: '1024x1024' },
    },
    {
      id: 'model-2',
      slug: 'sdxl',
      name: 'SDXL',
      modality: 'image',
      capabilities: ['image-generation'],
      description: null,
      outputType: 'image',
      costCredits: 6,
      tags: [],
      isActive: true,
      isFeatured: false,
      sortOrder: 20,
      defaultParams: {},
    },
  ],
  platforms: [
    {
      id: 'platform-1',
      name: 'doubao',
      baseUrl: null,
      apiKeyConfigured: false,
      isActive: true,
    },
    {
      id: 'platform-2',
      name: 'pptoken',
      baseUrl: 'https://cn.pptoken.cc/v1',
      apiKeyConfigured: true,
      isActive: true,
    },
  ],
  channels: [
    {
      id: 'channel-1',
      platformId: 'platform-1',
      platformName: 'doubao',
      modelSlug: 'doubao-seedream-5-0',
      sdkClient: 'image',
      sdkModelId: 'doubao-seedream-5-0-260128',
      priority: 1,
      costPerCall: '0.0300',
      costPerSecond: '0.0040',
      config: {},
      apiKeyConfigured: false,
      isActive: true,
    },
    {
      id: 'channel-2',
      platformId: 'platform-1',
      platformName: 'doubao',
      modelSlug: 'sdxl',
      sdkClient: 'image',
      sdkModelId: 'stability-ai/sdxl',
      priority: 2,
      costPerCall: '0.0200',
      costPerSecond: null,
      config: { baseUrl: 'https://cn.pptoken.cc/v1' },
      apiKeyConfigured: false,
      isActive: true,
    },
    {
      id: 'channel-3',
      platformId: 'platform-2',
      platformName: 'pptoken',
      modelSlug: 'gpt-image-2',
      sdkClient: 'openai',
      sdkModelId: 'gpt-image-2',
      priority: 1,
      costPerCall: '0.0500',
      costPerSecond: null,
      config: {},
      apiKeyConfigured: true,
      isActive: true,
    },
  ],
  routes: [
    { id: 'route-1', capabilitySlug: 'image-generation', modelSlug: 'doubao-seedream-5-0', priority: 1, isActive: true },
    { id: 'route-2', capabilitySlug: 'image-generation', modelSlug: 'sdxl', priority: 2, isActive: true },
  ],
  capabilities: [
    { slug: 'image-generation', name: '图片生成', sortOrder: 1 },
  ],
};

describe('ModelConfigTab', () => {
  beforeEach(() => {
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'admin-token' }));
    server.use(
      http.get('/api/admin/model-config', () => HttpResponse.json({ success: true, data: configuration })),
    );
  });

  it('加载配置并可切换模型、平台、渠道和默认路由视图', async () => {
    render(<ModelConfigTab />);

    expect(await screen.findByText('Doubao SeeDream 5.0')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '平台' }));
    expect(screen.getByText('pptoken')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '渠道' }));
    expect(screen.getByText('doubao-seedream-5-0-260128')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '默认路由' }));
    expect(screen.getByText('图片生成')).toBeInTheDocument();
  });

  it('编辑并保存模型积分成本', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/models/:slug', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: configuration.models[0] });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '编辑 Doubao SeeDream 5.0' }));
    const costInput = screen.getByLabelText('积分成本');
    await user.clear(costInput);
    await user.type(costInput, '12');
    await user.click(screen.getByRole('button', { name: '保存模型' }));

    await waitFor(() => expect(requestBody).toMatchObject({ costCredits: 12 }));
  });

  it('切换渠道状态并提交显式状态值', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/channels/:id/status', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: { ...configuration.channels[0], isActive: false } });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: '渠道' }));
    await user.click(await screen.findByRole('button', { name: '停用 doubao-seedream-5-0' }));

    await waitFor(() => expect(requestBody).toEqual({ isActive: false }));
  });

  it('切换平台状态并提交显式状态值', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/platforms/:id/status', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: { ...configuration.platforms[0], isActive: false } });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: '平台' }));
    await user.click(await screen.findByRole('button', { name: '停用 doubao' }));

    await waitFor(() => expect(requestBody).toEqual({ isActive: false }));
  });

  it('编辑渠道时提交按秒采购成本', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/channels/:id', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: configuration.channels[0] });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: '渠道' }));
    await user.click(await screen.findByRole('button', { name: '编辑 doubao-seedream-5-0 @ doubao' }));
    const costInput = screen.getByLabelText('每秒采购成本');
    await user.clear(costInput);
    await user.type(costInput, '0.006');
    await user.click(screen.getByRole('button', { name: '保存渠道' }));

    await waitFor(() => expect(requestBody).toMatchObject({ costPerSecond: 0.006 }));
  });

  it('按当前顺序完整保存能力路由', async () => {
    let requestBody: unknown;
    server.use(
      http.put('/api/admin/model-config/routes/:capabilitySlug', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: configuration.routes });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: '默认路由' }));
    await user.click(await screen.findByRole('button', { name: '保存路由' }));

    await waitFor(() => expect(requestBody).toEqual({
      modelSlugs: ['doubao-seedream-5-0', 'sdxl'],
    }));
  });

  it('显示平台级/渠道级 Key 配置状态徽章（模型视图不再显示密钥状态）', async () => {
    render(<ModelConfigTab />);

    expect(await screen.findByText('Doubao SeeDream 5.0')).toBeInTheDocument();
    // 模型视图不再有密钥徽章列

    await userEvent.click(screen.getByRole('button', { name: '平台' }));
    expect(await screen.findAllByText('未配置')).not.toHaveLength(0);
    expect(screen.getAllByText('已配置').length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByRole('button', { name: '渠道' }));
    expect((await screen.findAllByText('已配置')).length).toBeGreaterThanOrEqual(1);
  });

  it('编辑模型时填写网关参数并提交 defaultParams（业务参数，不含密钥）', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/models/:slug', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: configuration.models[0] });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '编辑 SDXL' }));
    await user.type(screen.getByLabelText('超时（毫秒）'), '120000');
    await user.type(screen.getByLabelText('温度'), '0.8');
    await user.click(screen.getByRole('button', { name: '保存模型' }));

    await waitFor(() => expect(requestBody).toMatchObject({
      defaultParams: { timeoutMs: 120000, temperature: 0.8 },
    }));
    // 模型 defaultParams 不应包含任何密钥/连接字段
    const params = (requestBody as { defaultParams: Record<string, unknown> }).defaultParams;
    expect(params.apiKey).toBeUndefined();
    expect(params.baseUrl).toBeUndefined();
  });

  it('编辑渠道时填写渠道 apiKey 并提交 config', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/channels/:id', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: configuration.channels[0] });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: '渠道' }));
    await user.click(await screen.findByRole('button', { name: '编辑 doubao-seedream-5-0 @ doubao' }));
    await user.type(screen.getByLabelText('API Key（渠道级）'), 'sk-new-channel-key');
    await user.click(screen.getByRole('button', { name: '保存渠道' }));

    await waitFor(() => expect(requestBody).toMatchObject({
      config: { apiKey: 'sk-new-channel-key' },
    }));
  });

  it('新增平台时提交 baseUrl 与 apiKey', async () => {
    let requestBody: unknown;
    server.use(
      http.post('/api/admin/model-config/platforms', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: configuration.platforms[0] });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: '平台' }));
    await user.click(await screen.findByRole('button', { name: '新增平台' }));
    await user.type(screen.getByLabelText('平台名称'), 'moonshot');
    await user.type(screen.getByLabelText('Base URL'), 'https://api.moonshot.cn/v1');
    await user.type(screen.getByLabelText('API Key（平台级）'), 'sk-moonshot');
    await user.click(screen.getByRole('button', { name: '保存平台' }));

    await waitFor(() => expect(requestBody).toMatchObject({
      name: 'moonshot',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: 'sk-moonshot',
    }));
  });

  it('编辑模型不填网关参数时 defaultParams 不含密钥', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/models/:slug', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: configuration.models[0] });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '编辑 Doubao SeeDream 5.0' }));
    await user.click(screen.getByRole('button', { name: '保存模型' }));

    await waitFor(() => expect(requestBody).not.toHaveProperty('defaultParams.apiKey'));
    await waitFor(() => expect(requestBody).not.toHaveProperty('defaultParams.baseUrl'));
  });

  it('渠道列表按平台分组显示组头（平台名 + 渠道数 + Key 状态 + Base URL）', async () => {
    render(<ModelConfigTab />);

    await screen.findByText('Doubao SeeDream 5.0');
    await userEvent.click(screen.getByRole('button', { name: '渠道' }));

    // 组头：doubao（2 个渠道） + pptoken（1 个渠道，已配置平台 Key）
    expect(await screen.findByText('doubao')).toBeInTheDocument();
    expect(screen.getByText('2 个渠道')).toBeInTheDocument();
    expect(screen.getByText('1 个渠道')).toBeInTheDocument();
    expect(screen.getByText('https://cn.pptoken.cc/v1')).toBeInTheDocument();
    expect(screen.getByText('pptoken')).toBeInTheDocument();
  });

  it('复制渠道：预填表单并在保存时提交 copyFromId', async () => {
    let requestBody: unknown;
    server.use(
      http.post('/api/admin/model-config/channels', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: { ...configuration.channels[0], id: 'channel-new', sdkModelId: 'doubao-seedream-6-0' } });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: '渠道' }));
    await user.click(await screen.findByRole('button', { name: '复制 doubao-seedream-5-0' }));

    // 弹窗预填平台 + 复制提示
    expect(screen.getByLabelText('平台')).toHaveValue('platform-1');
    expect(screen.getByText(/将复制 doubao · doubao-seedream-5-0-260128 的渠道配置/)).toBeInTheDocument();

    // 只改 SDK Model ID 后保存
    const sdkInput = screen.getByLabelText('SDK Model ID');
    await user.clear(sdkInput);
    await user.type(sdkInput, 'doubao-seedream-6-0');
    await user.click(screen.getByRole('button', { name: '保存渠道' }));

    await waitFor(() => expect(requestBody).toMatchObject({
      platformId: 'platform-1',
      modelSlug: 'doubao-seedream-5-0',
      sdkClient: 'image',
      sdkModelId: 'doubao-seedream-6-0',
      copyFromId: 'channel-1',
    }));
  });

  it('删除渠道提交 DELETE 请求', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let deleteCalled = false;
    server.use(
      http.delete('/api/admin/model-config/channels/:id', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true, data: { id: 'channel-1' } });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: '渠道' }));
    await user.click(await screen.findByRole('button', { name: '删除 doubao-seedream-5-0' }));

    await waitFor(() => expect(deleteCalled).toBe(true));
    confirmSpy.mockRestore();
  });
});
