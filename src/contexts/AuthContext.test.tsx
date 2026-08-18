/**
 * AuthContext 认证恢复（fetchUser）回归测试
 *
 * 背景（fix 3550269）：刷新页面误跳登录页。
 * 根因之一：fetchUser 自带一套独立的 refresh 逻辑，绕过 apiClient 的单例刷新，
 * 与子页面组件的 apiFetch 并发携带同一旧 refreshToken 刷新 → 轮换竞态 → 清 token。
 *
 * 本测试锁定修复后的契约：
 * - fetchUser 统一走 apiFetch（401 刷新 + 自动重试由 apiClient 单例处理）
 * - fetchUser 不再直接调用 /api/auth/refresh
 * - me 最终失败（刷新也失败）时清 token
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/apiClient';

const mockedApiFetch = vi.mocked(apiFetch);

const meUser = {
  id: 'u-1',
  email: 'test@vibeai.com',
  name: 'Test User',
  avatar: null,
  role: 'user',
  credits: 100,
  createdAt: '2026-01-01T00:00:00Z',
};

function Harness() {
  const { user, initializing } = useAuth();
  if (initializing) return <div>initializing…</div>;
  return <div>{user ? `user:${user.email}` : 'no-user'}</div>;
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );
}

describe('AuthContext 认证恢复', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedApiFetch.mockReset();
  });

  it('无 token 时直接完成初始化，不调用 apiFetch', async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByText('no-user')).toBeInTheDocument();
    });
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it('me 成功时恢复用户（fetchUser 走 apiFetch）', async () => {
    localStorage.setItem(
      'auth_tokens',
      JSON.stringify({ accessToken: 'at-1', refreshToken: 'rt-1' }),
    );
    mockedApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: meUser }), { status: 200 }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByText('user:test@vibeai.com')).toBeInTheDocument();
    });
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/auth/me');
  });

  it('me 最终 401（apiFetch 刷新失败）时清空 token', async () => {
    localStorage.setItem(
      'auth_tokens',
      JSON.stringify({ accessToken: 'at-expired', refreshToken: 'rt-expired' }),
    );
    mockedApiFetch.mockResolvedValue(new Response('{}', { status: 401 }));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByText('no-user')).toBeInTheDocument();
    });
    expect(localStorage.getItem('auth_tokens')).toBeNull();
  });

  it('回归：fetchUser 不再直接调用 /api/auth/refresh（刷新交给 apiFetch 单例）', async () => {
    localStorage.setItem(
      'auth_tokens',
      JSON.stringify({ accessToken: 'at-expired', refreshToken: 'rt-1' }),
    );
    // apiFetch 模拟"401 → 单例刷新 → 重试成功"，对外只暴露 200
    mockedApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: meUser }), { status: 200 }),
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 500 }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByText('user:test@vibeai.com')).toBeInTheDocument();
    });
    // mount 只触发 fetchUser，走 apiFetch；若回退到旧版手写 refresh 会调用原生 fetch
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

/**
 * 登录错误映射回归测试
 *
 * 背景（post-deploy bug）：生产经 Caddy 反代未启用 trust proxy，限流按入口容器 IP
 * 全站共享计数，登录 429 显示英文 "ThrottlerException: Too Many Requests"。
 * 修复：1) 后端 trust proxy + 限流放宽；2) 前端 429 → 友好中文提示。
 */
import { fireEvent } from '@testing-library/react';

function LoginHarness() {
  const { login, error } = useAuth();
  return (
    <div>
      <button onClick={() => login({ email: 'a@b.c', password: 'wrong-pass' })}>go-login</button>
      <span data-testid="login-err">{error ?? 'none'}</span>
    </div>
  );
}

describe('AuthContext 登录错误映射', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('429 限流 → 友好中文提示（而非 ThrottlerException）', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'ThrottlerException: Too Many Requests', error: 'Too Many Requests', statusCode: 429 }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    render(
      <AuthProvider>
        <LoginHarness />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText('go-login'));
    await waitFor(() =>
      expect(screen.getByTestId('login-err').textContent).toBe('操作过于频繁，请 1 分钟后再试'),
    );
  });

  it('401 保留后端语义错误（邮箱或密码错误）', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ message: '邮箱或密码错误', error: 'Unauthorized', statusCode: 401 }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    render(
      <AuthProvider>
        <LoginHarness />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText('go-login'));
    await waitFor(() => expect(screen.getByTestId('login-err').textContent).toBe('邮箱或密码错误'));
  });
});
