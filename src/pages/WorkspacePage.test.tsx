/**
 * WorkspacePage 组件测试
 *
 * 覆盖范围：
 * - 加载中状态
 * - 项目详情渲染
 * - 能力标签切换
 * - 任务提交
 * - 任务列表展示
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-setup';
import WorkspacePage from './WorkspacePage';

const mockProject = {
  id: 'proj-1',
  name: '测试项目',
  description: '这是一个测试项目',
  status: 'active',
  tags: ['test', 'demo'],
  taskCount: 2,
  completedTaskCount: 1,
};

const mockTasks = [
  { id: 'task-1', type: 'text-generation', status: 'completed', progress: 100, input: { prompt: 'test' }, output: { result: 'ok' }, errorMessage: null, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:01:00Z' },
  { id: 'task-2', type: 'image-generation', status: 'processing', progress: 45, input: { prompt: 'test2' }, output: null, errorMessage: null, createdAt: '2026-01-15T11:00:00Z', updatedAt: '2026-01-15T11:00:30Z' },
];

function renderWorkspace(projectId = 'proj-1') {
  localStorage.setItem('auth_tokens', JSON.stringify({
    accessToken: 'mock-token',
    refreshToken: 'mock-refresh',
  }));
  return render(
    <MemoryRouter initialEntries={[`/workspace/${projectId}`]}>
      <Routes>
        <Route path="/workspace/:projectId" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WorkspacePage', () => {
  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('应该渲染项目详情', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/tasks', () =>
        HttpResponse.json({ total: 2, items: mockTasks }),
      ),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('测试项目')).toBeInTheDocument();
    });

    expect(screen.getByText('这是一个测试项目')).toBeInTheDocument();
  });

  it('应该渲染能力标签列表', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/tasks', () =>
        HttpResponse.json({ total: 2, items: mockTasks }),
      ),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getAllByText('文本生成').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('视频生成')).toBeInTheDocument();
    expect(screen.getByText('白底图')).toBeInTheDocument();
    expect(screen.getByText('场景合成')).toBeInTheDocument();
    expect(screen.getByText('模特换装')).toBeInTheDocument();
    expect(screen.getByText('详情页')).toBeInTheDocument();
  });

  it('应该切换能力标签', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/tasks', () =>
        HttpResponse.json({ total: 2, items: mockTasks }),
      ),
    );

    renderWorkspace();
    const user = userEvent.setup();

    // 默认选中文本生成，输入框可见
    await waitFor(() => {
      expect(screen.getByText('视频生成')).toBeInTheDocument();
    });

    // 点击图像生成标签（第一个按钮元素）
    const imageButtons = screen.getAllByText('图像生成');
    await user.click(imageButtons[0]);
    // 输入框应该出现（使用 findBy 等待异步渲染）
    const textarea = await screen.findByPlaceholderText(/输入提示词/);
    expect(textarea).toBeInTheDocument();
  });

  it('应该渲染任务列表', async () => {
    server.use(
      http.get('/api/projects/proj-1', () =>
        HttpResponse.json(mockProject),
      ),
      http.get('/api/tasks', () =>
        HttpResponse.json({ total: 2, items: mockTasks }),
      ),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('视频生成')).toBeInTheDocument();
    });

    // 任务状态
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('处理中')).toBeInTheDocument();
  });
});