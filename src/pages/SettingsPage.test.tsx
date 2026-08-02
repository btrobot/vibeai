import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SettingsPage from './SettingsPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      email: 'test@vibeai.com',
      name: 'Test User',
      role: 'user',
      credits: 100,
      createdAt: '2026-01-01T00:00:00Z',
    },
    token: 'mock-token',
    initializing: false,
  }),
}));

function renderSettingsPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该渲染设置页面标题', () => {
    renderSettingsPage();
    expect(screen.getByText('设置')).toBeInTheDocument();
  });

  it('应该渲染个人资料区域', () => {
    renderSettingsPage();
    expect(screen.getByText('个人资料')).toBeInTheDocument();
    expect(screen.getByText('更新你的个人信息')).toBeInTheDocument();
  });

  it('应该显示用户邮箱', async () => {
    renderSettingsPage();
    await waitFor(() => {
      expect(screen.getByText('test@vibeai.com')).toBeInTheDocument();
    });
  });

  it('应该渲染修改密码区域', () => {
    renderSettingsPage();
    expect(screen.getAllByText('修改密码').length).toBeGreaterThanOrEqual(1);
  });

  it('应该渲染账户信息区域', () => {
    renderSettingsPage();
    expect(screen.getByText('账户信息')).toBeInTheDocument();
  });

  it('应该显示保存按钮', () => {
    renderSettingsPage();
    const saveBtn = screen.getByRole('button', { name: /保存/i });
    expect(saveBtn).toBeInTheDocument();
  });

  it('应该显示修改密码按钮', () => {
    renderSettingsPage();
    const passwordBtns = screen.getAllByRole('button', { name: /修改密码/i });
    expect(passwordBtns.length).toBeGreaterThan(0);
  });
});