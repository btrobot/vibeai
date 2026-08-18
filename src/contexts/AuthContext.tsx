import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ApiResponse, AuthResponse, UserResponse } from '@shared/index';
import { apiFetch } from '@/lib/apiClient';

/** 解析认证接口错误；429（限流）映射为友好中文提示，避免暴露 ThrottlerException 英文原始错误 */
async function extractAuthError(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    const errResult = JSON.parse(text) as { error?: string; message?: string };
    if (res.status === 429) return '操作过于频繁，请 1 分钟后再试';
    // message 为业务详情（如「邮箱或密码错误」），error 仅为 HTTP 状态描述（如 Unauthorized）→ message 优先
    return errResult.message || errResult.error || fallback;
  } catch {
    return fallback;
  }
}

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  login: (data: { email: string; password: string }) => Promise<{ success: boolean; user?: UserResponse; error?: string }>;
  register: (data: { email: string; password: string; name: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<UserResponse | null>;
  setError: (error: string | null) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getTokens = useCallback(() => {
    try {
      const stored = localStorage.getItem('auth_tokens');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const saveTokens = useCallback((tokens: { accessToken: string; refreshToken: string }) => {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }, []);

  const clearTokens = useCallback(() => {
    localStorage.removeItem('auth_tokens');
    setUser(null);
  }, []);

  const register = useCallback(async (data: { email: string; password: string; name: string }) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(await extractAuthError(res, '注册失败'));
      }
      const result: ApiResponse<{ id: string; email: string; name: string; role: string; credits: number; createdAt: string }> = await res.json();

      if (!result.success) {
        throw new Error(result.error || result.message || '注册失败');
      }

      return { success: true, message: result.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (data: { email: string; password: string }) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(await extractAuthError(res, '登录失败'));
      }

      const result: ApiResponse<AuthResponse> = await res.json();

      if (!result.success) {
        throw new Error(result.error || result.message || '登录失败');
      }

      const { user: userData, tokens } = result.data!;
      saveTokens(tokens);
      setUser(userData);

      return { success: true, user: userData };
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [saveTokens]);

  const logout = useCallback(async () => {
    const tokens = getTokens();
    if (tokens?.refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      } catch {
        // Ignore logout API errors
      }
    }
    clearTokens();
  }, [getTokens, clearTokens]);

  const fetchUser = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens?.accessToken) {
      setUser(null);
      return null;
    }

    try {
      // 统一走 apiFetch：401 时经 apiClient 单例刷新并自动重试。
      // 避免与页面其他组件（apiFetch）并发刷新同一 refreshToken 的轮换竞态。
      const res = await apiFetch(`${API_BASE}/auth/me`);
      const result: ApiResponse<UserResponse> = await res.json();
      if (res.ok && result.success && result.data) {
        setUser(result.data);
        return result.data;
      }
      clearTokens();
      return null;
    } catch {
      clearTokens();
      return null;
    }
  }, [getTokens, clearTokens]);

  // Auto-check login status on mount
  useEffect(() => {
    const tokens = getTokens();
    if (tokens?.accessToken) {
      fetchUser().finally(() => setInitializing(false));
    } else {
      setInitializing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tokens = getTokens();

  return (
    <AuthContext.Provider
      value={{
        user,
        token: tokens?.accessToken || null,
        loading,
        initializing,
        error,
        login,
        register,
        logout,
        fetchUser,
        setError,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}