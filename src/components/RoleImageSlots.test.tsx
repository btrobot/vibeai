import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleImageSlots, type RoleImageSlot } from './RoleImageSlots';
import type { UploadedRefImage } from './ReferenceImageStack';

const roles: RoleImageSlot[] = [
  { role: 'model', label: '模特图', max: 1 },
  { role: 'garment', label: '衣服图', max: 1 },
];

const files: UploadedRefImage[] = [
  { fileId: 'f-model', previewUrl: 'blob:model', name: 'model.png', role: 'model' },
  { fileId: 'f-garment', previewUrl: 'blob:garment', name: 'garment.png', role: 'garment' },
];

function renderSlots(overrides: Partial<React.ComponentProps<typeof RoleImageSlots>> = {}) {
  const props = {
    files,
    roles,
    uploading: false,
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<RoleImageSlots {...props} />);
  return props;
}

describe('RoleImageSlots', () => {
  it('空态：每个角色渲染一个"点击上传"槽位，点击触发 onAdd(role)', () => {
    const props = renderSlots({ files: [] });
    const modelSlot = screen.getByLabelText('模特图（点击上传）');
    const garmentSlot = screen.getByLabelText('衣服图（点击上传）');
    fireEvent.click(modelSlot);
    fireEvent.click(garmentSlot);
    expect(props.onAdd).toHaveBeenNthCalledWith(1, 'model');
    expect(props.onAdd).toHaveBeenNthCalledWith(2, 'garment');
  });

  it('有图：显示缩略图 + 角色标签，点击槽位触发 onAdd(role)（替换语义）', () => {
    const props = renderSlots();
    expect(screen.getByLabelText('模特图（已上传，点击替换）')).toBeInTheDocument();
    expect(screen.getByLabelText('衣服图（已上传，点击替换）')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('模特图（已上传，点击替换）'));
    expect(props.onAdd).toHaveBeenCalledWith('model');
  });

  it('移除按钮按 fileId 触发 onRemove', () => {
    const props = renderSlots();
    fireEvent.click(screen.getByLabelText('移除模特图'));
    fireEvent.click(screen.getByLabelText('移除衣服图'));
    expect(props.onRemove).toHaveBeenNthCalledWith(1, 'f-model');
    expect(props.onRemove).toHaveBeenNthCalledWith(2, 'f-garment');
  });

  it('上传中禁用槽位', () => {
    renderSlots({ files: [], uploading: true });
    expect(screen.getByLabelText('模特图（点击上传）')).toBeDisabled();
    expect(screen.getByLabelText('衣服图（点击上传）')).toBeDisabled();
  });
});
