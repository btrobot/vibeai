import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferenceImageStack, type UploadedRefImage } from './ReferenceImageStack';

const files: UploadedRefImage[] = [
  { fileId: 'f-1', previewUrl: 'blob:1', name: 'a.png' },
  { fileId: 'f-2', previewUrl: 'blob:2', name: 'b.png' },
  { fileId: 'f-3', previewUrl: 'blob:3', name: 'c.png' },
];

function renderStack(overrides: Partial<React.ComponentProps<typeof ReferenceImageStack>> = {}) {
  const props = {
    files,
    uploading: false,
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  const utils = render(<ReferenceImageStack {...props} />);
  return { props, utils };
}

describe('ReferenceImageStack', () => {
  it('空态显示上传按钮并触发 onAdd', () => {
    const { props } = renderStack({ files: [] });
    const addBtn = screen.getByLabelText('上传参考图');
    fireEvent.click(addBtn);
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it('空态上传中显示加载态并禁用按钮', () => {
    renderStack({ files: [], uploading: true });
    const addBtn = screen.getByLabelText('上传参考图');
    expect(addBtn).toBeDisabled();
  });

  it('disabled（提交中）时上传按钮禁用', () => {
    renderStack({ files: [], disabled: true });
    expect(screen.getByLabelText('上传参考图')).toBeDisabled();
  });

  it('有图时渲染每张卡片与移除按钮（hover 显示）', () => {
    renderStack();
    expect(screen.getAllByRole('img')).toHaveLength(3);
    // 折叠态移除按钮存在但不可见；hover 卡片后可见
    const removeBtn = screen.getByLabelText('移除参考图 1');
    expect(removeBtn).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getAllByRole('img')[0].closest('.group') as HTMLElement);
    expect(removeBtn).toHaveClass('group-hover:opacity-100');
  });

  it('点击移除按钮按 fileId 触发 onRemove', () => {
    const { props } = renderStack();
    fireEvent.mouseEnter(screen.getAllByRole('img')[1].closest('.group') as HTMLElement);
    fireEvent.click(screen.getByLabelText('移除参考图 2'));
    expect(props.onRemove).toHaveBeenCalledWith('f-2');
  });

  it('hover 展开扇形后显示 add 按钮与清空按钮', () => {
    const { props } = renderStack();
    // 折叠态 add 按钮存在（虚线卡）
    expect(screen.getByLabelText('添加参考图')).toBeInTheDocument();
    // hover 容器展开
    const container = screen.getByLabelText('添加参考图').closest('.relative') as HTMLElement;
    fireEvent.mouseEnter(container);
    expect(screen.getByLabelText('清空参考图')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('清空参考图'));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('展开态添加按钮触发 onAdd', () => {
    const { props } = renderStack();
    const container = screen.getByLabelText('添加参考图').closest('.relative') as HTMLElement;
    fireEvent.mouseEnter(container);
    fireEvent.click(screen.getByLabelText('添加参考图'));
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it('达到上限 9 张时不显示 add 按钮', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      fileId: `f-${i}`,
      previewUrl: `blob:${i}`,
      name: `${i}.png`,
    }));
    renderStack({ files: many });
    expect(screen.queryByLabelText('添加参考图')).not.toBeInTheDocument();
  });

  it('单张时不显示清空按钮（用单卡移除即可）', () => {
    renderStack({ files: [files[0]] });
    expect(screen.queryByLabelText('清空参考图')).not.toBeInTheDocument();
  });

  it('mouseLeave 收起扇形（清空按钮消失）', () => {
    renderStack();
    const container = screen.getByLabelText('添加参考图').closest('.relative') as HTMLElement;
    fireEvent.mouseEnter(container);
    expect(screen.getByLabelText('清空参考图')).toBeInTheDocument();
    fireEvent.mouseLeave(container);
    expect(screen.queryByLabelText('清空参考图')).not.toBeInTheDocument();
  });
});
