/**
 * ImageParamAggregate 组件测试
 *
 * 参数项由模型 inputSchema（SOT）驱动：
 * - gpt-image-2：比例 + 质量（摘要「1:1 · 低」）
 * - seedream：仅规格（摘要「2K」）
 * - 无可调参数模型（sdxl/flux）：不渲染
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageParamAggregate } from './ImageParamAggregate';

function model(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'm',
    name: 'M',
    description: null,
    costCredits: 10,
    tags: [],
    isDefault: false,
    sortOrder: 1,
    capabilities: ['image-generation'],
    modality: 'image',
    ...overrides,
  };
}

describe('ImageParamAggregate', () => {
  it('gpt-image-2：inputSchema 驱动比例+质量，摘要「1:1 · 低」，选择后 onChange 携带 ratio', async () => {
    const onChange = vi.fn();
    const gpt = model({
      constraints: { supportsImageToImage: true },
      inputSchema: {
        properties: {
          aspect_ratio: { enum: ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'], default: '1:1' },
          quality: { enum: ['low', 'medium', 'high', 'auto'], default: 'low' },
        },
      },
      defaultParams: { aspect_ratio: '1:1', quality: 'low' },
    });

    render(<ImageParamAggregate model={gpt} value={{}} onChange={onChange} />);
    const btn = screen.getByRole('button', { name: '图片参数' });
    expect(btn).toHaveTextContent('1:1 · 低');

    await userEvent.click(btn);
    await userEvent.click(screen.getByRole('button', { name: /9:16/ }));
    // 组件契约：onChange 携带 patch（父组件负责累积 specParams）
    expect(onChange).toHaveBeenLastCalledWith({ ratio: '9:16' });

    // 质量选择（value prop 由父组件传入，此处仍为 {}）
    await userEvent.click(screen.getByRole('button', { name: '高' }));
    expect(onChange).toHaveBeenLastCalledWith({ quality: 'high' });
  });

  it('seedream：仅规格（constraints.sizes），摘要「2K」', async () => {
    const onChange = vi.fn();
    const seedream = model({
      constraints: { sizes: ['2K', '4K'], supportsImageToImage: true },
      defaultParams: { size: '2K' },
    });

    render(<ImageParamAggregate model={seedream} value={{}} onChange={onChange} />);
    const btn = screen.getByRole('button', { name: '图片参数' });
    expect(btn).toHaveTextContent('2K');
    expect(btn).not.toHaveTextContent('比例');

    await userEvent.click(btn);
    await userEvent.click(screen.getByRole('button', { name: '4K' }));
    expect(onChange).toHaveBeenCalledWith({ size: '4K' });
  });

  it('无可调参数模型（无 inputSchema enum / constraints）不渲染', () => {
    const onChange = vi.fn();
    const sdxl = model({ constraints: {} });
    const { container } = render(<ImageParamAggregate model={sdxl} value={{}} onChange={onChange} />);
    expect(container.firstChild).toBeNull();
  });

  it('非图片模型不渲染', () => {
    const onChange = vi.fn();
    const llm = model({ modality: 'llm' });
    const { container } = render(<ImageParamAggregate model={llm} value={{}} onChange={onChange} />);
    expect(container.firstChild).toBeNull();
  });
});
