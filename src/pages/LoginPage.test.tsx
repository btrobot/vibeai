/**
 * LoginPage 组件测试
 *
 * 覆盖范围：
 * - 渲染登录表单
 * - 表单字段验证
 * - 提交登录请求
 * - 错误状态显示
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-setup';
import { AuthProvider } from '../contexts/AuthContext';
import LoginPage from './LoginPage';

function renderLoginPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('应该渲染登录表单', () => {
    renderLoginPage();

    // 验证表单元素存在
    expect(screen.getByText('欢迎回来')).toBeInTheDocument();
    expect(screen.getByText('登录你的 VibeAI 账户')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录/ })).toBeInTheDocument();
  });

  it('应该显示空字段验证错误', async () => {
    renderLoginPage();
    const user = userEvent.setup();

    // 不填写内容直接点击登录
    await user.click(screen.getByRole('button', { name: /登录/ }));

    expect(screen.getByText('请填写所有字段')).toBeInTheDocument();
  });

  it('应该显示密码错误提示', async () => {
    // 模拟登录失败
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { success: false, error: '邮箱或密码错误' },
          { status: 401 },
        ),
      ),
    );

    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('name@example.com'), 'test@vibeai.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /登录/ }));

    // 等待错误提示出现
    const errorMsg = await screen.findByText(/邮箱或密码错误/);
    expect(errorMsg).toBeInTheDocument();
  });
});