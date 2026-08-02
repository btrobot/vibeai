import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToolPage from './ToolPage';

function renderToolPage(toolType: string) {
  const toolRoutes: Record<string, string> = {
    'background-removal': 'background-removal',
    'scene-composition': 'scene-composition',
    'model-dressing': 'model-dressing',
    'detail-page': 'detail-page',
    'invalid-tool': 'invalid-tool',
  };
  const route = toolRoutes[toolType] ?? toolType;
  return render(
    <MemoryRouter initialEntries={[`/tools/${route}`]}>
      <Routes>
        <Route path="/tools/background-removal" element={<ToolPage toolSlug="background-removal" />} />
        <Route path="/tools/scene-composition" element={<ToolPage toolSlug="scene-composition" />} />
        <Route path="/tools/model-dressing" element={<ToolPage toolSlug="model-dressing" />} />
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

  it('应该渲染白底图生成工具', () => {
    renderToolPage('background-removal');
    expect(screen.getByText('白底图生成')).toBeInTheDocument();
    expect(screen.getByText('一键去除商品背景，生成纯白底图，支持批量处理')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/去除背景，保留商品主体/)).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
  });

  it('应该渲染场景合成工具', () => {
    renderToolPage('scene-composition');
    expect(screen.getByText('场景合成')).toBeInTheDocument();
    expect(screen.getByText('将商品智能融入各类场景，生成自然逼真的场景图')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/将商品放在自然光下的木桌上/)).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
  });

  it('应该渲染模特换装工具', () => {
    renderToolPage('model-dressing');
    expect(screen.getByText('模特换装')).toBeInTheDocument();
    expect(screen.getByText('AI 虚拟模特换装，快速生成不同穿搭效果图')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/模特穿这件衣服在户外街拍/)).toBeInTheDocument();
    expect(screen.getByText('开始生成')).toBeInTheDocument();
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

  it('应该渲染上传图片区域', () => {
    renderToolPage('background-removal');
    expect(screen.getByText('上传图片')).toBeInTheDocument();
    expect(screen.getByText('点击上传图片')).toBeInTheDocument();
  });

  it('应该渲染生成结果区域', () => {
    renderToolPage('background-removal');
    expect(screen.getByText('生成结果')).toBeInTheDocument();
  });
});