/**
 * image-capability-consistency.test.ts
 *
 * 防漂移测试：前端图片能力常量与 specs/gateway.spec.yaml 的
 * seed_data.capabilities（Spec SOT）双向一一对应。
 *
 * 2026-08 L1/L2 分层（对齐 RunningHub）：
 *   L1 生成层 = image-generation（文生图）/ image-editing（图片编辑），无 refImageRoles（参考图无角色槽位，语义由 prompt 描述）
 *     → 工作区能力选择器 SELECTABLE_IMAGE_CAPABILITIES 仅覆盖 L1（图片 Tab 纯自动识别）
 *   L2 后处理层 = background-removal / scene-composition / model-dressing（白底/场景/换装），enabled: true，
 *     → 经独立工具页 /tools/* 开放（ToolPage.toolConfig 全覆盖），refImageRoles 作为工具页参考图槽位语义文档
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { IMAGE_OUTPUT_CAPABILITIES, SELECTABLE_IMAGE_CAPABILITIES } from './WorkspacePage';
import { toolConfig } from './ToolPage';

interface SpecRefRole { role: string; label: string; max: number }
interface SpecCapabilitySeed { slug: string; enabled: boolean; refImageRoles: SpecRefRole[] }

describe('图片能力 Spec 一致性（gateway.spec.yaml = SOT）', () => {
  let specCaps: SpecCapabilitySeed[];

  beforeAll(() => {
    const specPath = path.resolve(__dirname, '../../specs/gateway.spec.yaml');
    const spec = yaml.load(fs.readFileSync(specPath, 'utf8')) as Record<string, unknown>;
    const seedData = spec.seed_data as { capabilities: SpecCapabilitySeed[] };
    specCaps = seedData.capabilities;
  });

  it('spec capabilities 清单与 IMAGE_OUTPUT_CAPABILITIES 一一对应（含历史屏蔽能力）', () => {
    const specSlugs = specCaps.map((c) => c.slug).sort();
    const codeSlugs = [...IMAGE_OUTPUT_CAPABILITIES].sort();
    expect(specSlugs).toEqual(codeSlugs);
  });

  it('工作区可新建图片能力 SELECTABLE_IMAGE_CAPABILITIES = spec L1 生成层（enabled 且 refImageRoles 空）', () => {
    const l1Slugs = specCaps
      .filter((c) => c.enabled && c.refImageRoles.length === 0)
      .map((c) => c.slug)
      .sort();
    const selectableSlugs = [...SELECTABLE_IMAGE_CAPABILITIES].sort();
    expect(l1Slugs).toEqual(selectableSlugs);
  });

  it('L1 生成层（enabled 且 refImageRoles 空）能力无 refImageRoles —— 图片编辑 = 通用多参考图，无角色槽位', () => {
    const l1Caps = specCaps.filter((c) => c.enabled && c.refImageRoles.length === 0);
    for (const cap of l1Caps) {
      expect(cap.refImageRoles, `L1 能力 ${cap.slug} 不应定义 refImageRoles`).toEqual([]);
    }
  });

  it('L2 后处理层（refImageRoles 非空）能力：enabled: true + 独立工具页全覆盖 + 不污染工作区选择器', () => {
    const l2Caps = specCaps.filter((c) => c.refImageRoles.length > 0);
    expect(l2Caps.length).toBeGreaterThan(0);
    const toolSlugs = new Set(Object.keys(toolConfig));
    for (const cap of l2Caps) {
      expect(cap.enabled, `L2 能力 ${cap.slug} 应 enabled: true（经独立工具页开放）`).toBe(true);
      for (const r of cap.refImageRoles) {
        expect(r.max).toBeGreaterThanOrEqual(1);
      }
      expect(toolSlugs.has(cap.slug), `L2 能力 ${cap.slug} 缺少独立工具页（ToolPage.toolConfig）`).toBe(true);
      expect([...SELECTABLE_IMAGE_CAPABILITIES]).not.toContain(cap.slug);
    }
  });
});
