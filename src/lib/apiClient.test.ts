import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiFetch, getTokens, saveTokens, clearTokens } from './apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('无 token 时请求不带 Authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/gateway/models');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/gateway/models');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('有 token 时自动附加 Authorization', async () => {
    saveTokens({ accessToken: 'at-1', refreshToken: 'rt-1' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/gateway/models');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer at-1');
  });

  it('401 时刷新 token 并重试一次', async () => {
    saveTokens({ accessToken: 'at-expired', refreshToken: 'rt-1' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 })) // models 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { tokens: { accessToken: 'at-new', refreshToken: 'rt-2' } } }), { status: 200 }),
      ) // refresh 成功
      .mockResolvedValueOnce(new Response('{"data":[]}', { status: 200 })); // 重试成功

    vi.stubGlobal('fetch', fetchMock);

    const res = await apiFetch('/api/gateway/models');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // 重试请求带新 token
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer at-new');
    // 刷新后 localStorage 更新
    expect(getTokens()?.accessToken).toBe('at-new');
  });

  it('401 且刷新失败时返回原始 401', async () => {
    saveTokens({ accessToken: 'at-expired', refreshToken: 'rt-expired' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 })) // models 401
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 401 })); // refresh 失败

    vi.stubGlobal('fetch', fetchMock);

    const res = await apiFetch('/api/gateway/models');

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('并发 401 只触发一次 refresh', async () => {
    saveTokens({ accessToken: 'at-expired', refreshToken: 'rt-1' });
    let refreshCalls = 0;
    let nonRefreshCalls = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 30));
        return new Response(JSON.stringify({ success: true, data: { tokens: { accessToken: 'at-new', refreshToken: 'rt-2' } } }), { status: 200 });
      }
      nonRefreshCalls++;
      // 前两次原始请求 401，刷新后的重试请求 200
      return new Response('{}', { status: nonRefreshCalls <= 2 ? 401 : 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const [r1, r2] = await Promise.all([apiFetch('/api/gateway/models'), apiFetch('/api/gateway/models')]);

    expect(refreshCalls).toBe(1); // 单例刷新
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  it('getTokens/saveTokens/clearTokens 与 AuthContext 的 auth_tokens 键兼容', () => {
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'at-x', refreshToken: 'rt-x' }));
    expect(getTokens()).toEqual({ accessToken: 'at-x', refreshToken: 'rt-x' });

    clearTokens();
    expect(getTokens()).toBeNull();
  });
});
