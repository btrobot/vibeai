import { beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// 默认 MSW handlers（各测试可覆盖）
export const defaultHandlers = [
  http.post('/api/auth/login', () =>
    HttpResponse.json({
      success: true,
      data: {
        user: {
          id: '1',
          email: 'test@vibeai.com',
          name: 'Test User',
          role: 'user',
          avatar_url: null,
        },
        tokens: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 900,
        },
      },
    }),
  ),

  http.get('/api/auth/me', () =>
    HttpResponse.json({
      success: true,
      data: {
        id: '1',
        email: 'test@vibeai.com',
        name: 'Test User',
        role: 'user',
        avatar_url: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    }),
  ),

  http.post('/api/auth/register', () =>
    HttpResponse.json({
      success: true,
      data: {
        user: {
          id: '2',
          email: 'new@vibeai.com',
          name: 'New User',
          role: 'user',
          avatar_url: null,
        },
        tokens: {
          access_token: 'mock-access-token-new',
          refresh_token: 'mock-refresh-token-new',
          expires_in: 900,
        },
      },
    }),
  ),
];

export const server = setupServer(...defaultHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());