import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ApiResponse, AuthResponse, UserResponse } from '@shared/index';

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

      const result: ApiResponse<{ id: string; email: string; name: string; role: string; credits: number; createdAt: string }> = await res.json();

      if (!res.ok || !result.success) {
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
        const text = await res.text();
        let errorMsg = '登录失败';
        try {
          const errResult = JSON.parse(text);
          errorMsg = errResult.error || errResult.message || errorMsg;
        } catch {
          // use default error message
        }
        throw new Error(errorMsg);
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
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      const result: ApiResponse<UserResponse> = await res.json();
      if (res.ok && result.success && result.data) {
        setUser(result.data);
        return result.data;
      }

      // Try refresh
      if (res.status === 401 && tokens.refreshToken) {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });

        const refreshResult: ApiResponse<AuthResponse> = await refreshRes.json();
        if (refreshRes.ok && refreshResult.success && refreshResult.data) {
          saveTokens(refreshResult.data.tokens);
          setUser(refreshResult.data.user);
          return refreshResult.data.user;
        }
      }

      clearTokens();
      return null;
    } catch {
      clearTokens();
      return null;
    }
  }, [getTokens, saveTokens, clearTokens]);

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