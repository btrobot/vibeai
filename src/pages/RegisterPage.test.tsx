import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { server } from '../test/msw-setup';
import { AuthProvider } from '../contexts/AuthContext';
import RegisterPage from './RegisterPage';

function renderRegisterPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该渲染注册表单', () => {
    renderRegisterPage();
    const [heading, ..._rest] = screen.getAllByText('创建账户');
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('注册 VibeAI 账户，开始创作')).toBeInTheDocument();
    expect(screen.getByLabelText('昵称')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建账户' })).toBeInTheDocument();
  });

  it('应该显示空字段验证错误', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: '创建账户' }));

    expect(screen.getByText('请填写所有字段')).toBeInTheDocument();
  });

  it('应该显示密码不一致错误', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('昵称'), 'Test User');
    await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密码'), 'password123');
    await user.type(screen.getByLabelText('确认密码'), 'different');
    await user.click(screen.getByRole('button', { name: '创建账户' }));

    expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument();
  });

  it('应该显示密码长度错误', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('昵称'), 'Test User');
    await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密码'), 'short');
    await user.type(screen.getByLabelText('确认密码'), 'short');
    await user.click(screen.getByRole('button', { name: '创建账户' }));

    expect(screen.getByText('密码至少需要 8 位字符')).toBeInTheDocument();
  });

  it('应该显示密码可见切换', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const passwordInput = screen.getByLabelText('密码');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: '显示密码' });
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('应该渲染登录链接', () => {
    renderRegisterPage();
    const loginLink = screen.getByText('立即登录');
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });
});