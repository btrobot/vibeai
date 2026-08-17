import { beforeEach, describe, expect, it } from 'vitest';
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
    },
  ],
  providers: [
    {
      id: 'provider-1',
      modelSlug: 'doubao-seedream-5-0',
      providerName: 'doubao',
      sdkClient: 'image',
      sdkModelId: 'doubao-seedream-5-0-260128',
      priority: 1,
      costPerCall: '0.0300',
      costPerSecond: '0.0040',
      config: {},
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

  it('加载配置并可切换模型、Provider 和默认路由视图', async () => {
    render(<ModelConfigTab />);

    expect(await screen.findByText('Doubao SeeDream 5.0')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Provider' }));
    expect(screen.getByText('doubao-seedream-5-0-260128')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '默认路由' }));
    expect(screen.getByText('图片生成')).toBeInTheDocument();
  });

  it('编辑并保存模型用户积分成本', async () => {
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
    const costInput = screen.getByLabelText('用户积分成本');
    await user.clear(costInput);
    await user.type(costInput, '12');
    await user.click(screen.getByRole('button', { name: '保存模型' }));

    await waitFor(() => expect(requestBody).toMatchObject({ costCredits: 12 }));
  });

  it('切换 Provider 状态并提交显式状态值', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/providers/:id/status', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: { ...configuration.providers[0], isActive: false } });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: 'Provider' }));
    await user.click(await screen.findByRole('button', { name: '停用 doubao' }));

    await waitFor(() => expect(requestBody).toEqual({ isActive: false }));
  });

  it('编辑 Provider 时提交按秒采购成本', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/admin/model-config/providers/:id', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: configuration.providers[0] });
      }),
    );
    render(<ModelConfigTab />);
    const user = userEvent.setup();

    await screen.findByText('Doubao SeeDream 5.0');
    await user.click(screen.getByRole('button', { name: 'Provider' }));
    await user.click(await screen.findByRole('button', { name: '编辑 doubao' }));
    const costInput = screen.getByLabelText('每秒采购成本');
    await user.clear(costInput);
    await user.type(costInput, '0.006');
    await user.click(screen.getByRole('button', { name: '保存 Provider' }));

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
});
