import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToolPage from './ToolPage';

function renderToolPage(toolType: string) {
  const toolRoutes: Record<string, string> = {
    'detail-page': 'detail-page',
    'invalid-tool': 'invalid-tool',
    // 屏蔽的工具：访问路径仍可渲染（走 :toolType 兜底），应显示"工具不存在"
    'background-removal': 'background-removal',
    'scene-composition': 'scene-composition',
    'model-dressing': 'model-dressing',
  };
  const route = toolRoutes[toolType] ?? toolType;
  return render(
    <MemoryRouter initialEntries={[`/tools/${route}`]}>
      <Routes>
        <Route path="/tools/detail-page" element={<ToolPage toolSlug="detail-page" />} />
        <Route path="/tools/:toolType" element={<ToolPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ToolPage', () => {
  beforeEach(() => {
    localStorage.setItem('auth_tokens', JSON.stringify({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('屏蔽：白底图工具入口不再可用（显示工具不存在）', () => {
    renderToolPage('background-removal');
    expect(screen.getByText('工具不存在')).toBeInTheDocument();
    expect(screen.queryByText('白底图生成')).not.toBeInTheDocument();
  });

  it('屏蔽：场景合成工具入口不再可用（显示工具不存在）', () => {
    renderToolPage('scene-composition');
    expect(screen.getByText('工具不存在')).toBeInTheDocument();
    expect(screen.queryByText('场景合成')).not.toBeInTheDocument();
  });

  it('屏蔽：模特换装工具入口不再可用（显示工具不存在）', () => {
    renderToolPage('model-dressing');
    expect(screen.getByText('工具不存在')).toBeInTheDocument();
    expect(screen.queryByText('模特换装')).not.toBeInTheDocument();
  });

  it('应该渲染详情页生成工具', () => {
    renderToolPage('detail-page');
    expect(screen.getByText('详情页生成')).toBeInTheDocument();
    expect(screen.getByText('AI 自动生成商品详情页，包含文案、排版、图片')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/生成包含商品详情、规格、卖点的详情页/)).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
  });

  it('应该显示工具不存在当访问无效工具类型', () => {
    renderToolPage('invalid-tool');
    expect(screen.getByText('工具不存在')).toBeInTheDocument();
  });

  it('应该渲染上传图片区域（详情页工具）', () => {
    renderToolPage('detail-page');
    expect(screen.getByText('上传图片')).toBeInTheDocument();
    expect(screen.getByText('点击上传图片')).toBeInTheDocument();
  });

  it('应该渲染生成结果区域（详情页工具）', () => {
    renderToolPage('detail-page');
    expect(screen.getByText('生成结果')).toBeInTheDocument();
  });
});