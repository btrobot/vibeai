import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('应该渲染分类标签', async () => {
    renderGalleryPage();
    expect(await screen.findByText('热门')).toBeInTheDocument();
    expect(screen.getByText('最新')).toBeInTheDocument();
    expect(screen.getByText('关注')).toBeInTheDocument();
  });

  it('应该默认选中热门标签', async () => {
    renderGalleryPage();
    const hotTab = (await screen.findByText('热门')).closest('button');
    expect(hotTab).toHaveClass('border-emerald-500');
  });

  it('应该支持切换标签', async () => {
    renderGalleryPage();
    const latestTab = (await screen.findByText('最新')).closest('button');
    expect(latestTab).toBeInTheDocument();
  });

  it('应该显示空状态', async () => {
    renderGalleryPage();
    expect(await screen.findByText('暂无作品')).toBeInTheDocument();
  });
});