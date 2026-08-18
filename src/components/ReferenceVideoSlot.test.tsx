import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferenceVideoSlot, type UploadedRefVideo } from './ReferenceVideoSlot';

function renderSlot(overrides: Partial<React.ComponentProps<typeof ReferenceVideoSlot>> = {}) {
  const props = {
    video: null,
    uploading: false,
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<ReferenceVideoSlot {...props} />);
  return props;
}

describe('ReferenceVideoSlot', () => {
  it('空态：显示"点击上传"槽位，点击触发 onSelect', () => {
    const props = renderSlot();
    const btn = screen.getByLabelText('参考视频（点击上传）');
    fireEvent.click(btn);
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  it('有视频：显示名称与替换入口，点击触发 onSelect（替换语义）', () => {
    const video: UploadedRefVideo = { fileId: 'v-1', previewUrl: 'blob:vid', name: 'style.mp4' };
    const props = renderSlot({ video });
    expect(screen.getByText('style.mp4')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('参考视频（已上传，点击替换）'));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  it('移除按钮触发 onRemove', () => {
    const video: UploadedRefVideo = { fileId: 'v-1', previewUrl: 'blob:vid', name: 'style.mp4' };
    const props = renderSlot({ video });
    fireEvent.click(screen.getByLabelText('移除参考视频'));
    expect(props.onRemove).toHaveBeenCalledTimes(1);
  });

  it('上传中禁用槽位', () => {
    renderSlot({ uploading: true });
    expect(screen.getByLabelText('参考视频（点击上传）')).toBeDisabled();
  });
});
