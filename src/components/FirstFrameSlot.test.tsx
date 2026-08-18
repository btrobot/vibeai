import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirstFrameSlot, type UploadedFirstFrame } from './FirstFrameSlot';

function renderSlot(overrides: Partial<React.ComponentProps<typeof FirstFrameSlot>> = {}) {
  const props = {
    frame: null,
    uploading: false,
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<FirstFrameSlot {...props} />);
  return props;
}

describe('FirstFrameSlot', () => {
  it('空态：显示"点击上传"槽位，点击触发 onSelect', () => {
    const props = renderSlot();
    fireEvent.click(screen.getByLabelText('首帧图（点击上传）'));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  it('有图：点击槽位触发 onSelect（替换语义）', () => {
    const frame: UploadedFirstFrame = { fileId: 'ff-1', previewUrl: 'blob:ff', name: 'start.png' };
    const props = renderSlot({ frame });
    expect(screen.getByText('start.png')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('首帧图（已上传，点击替换）'));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  it('移除按钮触发 onRemove', () => {
    const frame: UploadedFirstFrame = { fileId: 'ff-1', previewUrl: 'blob:ff', name: 'start.png' };
    const props = renderSlot({ frame });
    fireEvent.click(screen.getByLabelText('移除首帧图'));
    expect(props.onRemove).toHaveBeenCalledTimes(1);
  });

  it('上传中禁用槽位', () => {
    renderSlot({ uploading: true });
    expect(screen.getByLabelText('首帧图（点击上传）')).toBeDisabled();
  });
});
