/**
 * 统一 API 客户端
 *
 * 职责：
 * 1. 自动附加 access token（Authorization: Bearer）到所有请求
 * 2. 401 时自动刷新 token 并重试一次（refresh token 轮换，需单例化刷新避免并发竞争）
 *
 * 用法：const res = await apiFetch('/api/gateway/models?capability=text-generation');
 */
interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

const TOKEN_KEY = 'auth_tokens';

export function getTokens(): StoredTokens | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    return stored ? (JSON.parse(stored) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokensOnce(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    const result = (await res.json()) as {
      success?: boolean;
      data?: { tokens: StoredTokens };
    };
    if (res.ok && result.success && result.data?.tokens) {
      saveTokens(result.data.tokens);
      return true;
    }
  } catch {
    // 网络异常，返回 false，调用方按失败处理
  }
  return false;
}

/** 单例刷新：并发 401 只触发一次 refresh，其余请求等待同一 Promise */
function refreshTokens(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshTokensOnce().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function mergeHeaders(init: RequestInit, token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const tokens = getTokens();
  const res = await fetch(path, { ...init, headers: mergeHeaders(init, tokens?.accessToken) });

  // access token 过期 → 刷新后重试一次
  if (res.status === 401 && tokens?.refreshToken) {
    const ok = await refreshTokens();
    if (ok) {
      const fresh = getTokens();
      return fetch(path, { ...init, headers: mergeHeaders(init, fresh?.accessToken) });
    }
  }
  return res;
}
