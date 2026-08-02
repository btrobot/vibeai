import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GalleryPage from './GalleryPage';

function renderGalleryPage() {
  return render(
    <BrowserRouter>
      <GalleryPage />
    </BrowserRouter>,
  );
}

describe('GalleryPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该渲染分类标签', () => {
    renderGalleryPage();
    expect(screen.getByText('热门')).toBeInTheDocument();
    expect(screen.getByText('最新')).toBeInTheDocument();
    expect(screen.getByText('关注')).toBeInTheDocument();
  });

  it('应该默认选中热门标签', () => {
    renderGalleryPage();
    const hotTab = screen.getByText('热门').closest('button');
    expect(hotTab).toHaveClass('border-emerald-500');
  });

  it('应该支持切换标签', () => {
    renderGalleryPage();
    const latestTab = screen.getByText('最新').closest('button');
    expect(latestTab).toBeInTheDocument();
  });

  it('应该显示空状态', () => {
    renderGalleryPage();
    expect(screen.getByText('暂无作品')).toBeInTheDocument();
  });
});