import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from './AdminPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      email: 'admin@vibeai.com',
      name: 'Admin',
      role: 'admin',
      credits: 9999,
      createdAt: '2026-01-01T00:00:00Z',
    },
    token: 'mock-token',
    initializing: false,
  }),
}));

describe('AdminPage', () => {
  it('应该渲染管理后台标题', () => {
    render(
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>,
    );
    expect(screen.getByText('管理后台')).toBeInTheDocument();
  });
});