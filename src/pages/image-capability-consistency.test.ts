/**
 * image-capability-consistency.test.ts
 *
 * 防漂移测试：前端图片能力常量与 specs/gateway.spec.yaml 的
 * seed_data.capabilities（Spec SOT）双向一一对应。
 *
 * 2026-08 L1/L2 分层（对齐 RunningHub）：
 *   L1 生成层 = image-generation（文生图）/ image-editing（图片编辑），无 refImageRoles（参考图无角色槽位，语义由 prompt 描述）
 *   L2 后处理层 = background-removal / scene-composition / model-dressing（白底/场景/换装），enabled: false，
 *                 refImageRoles 仅作历史/未来 L2 语义文档，前端 L1 不消费（无对应代码常量）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { IMAGE_OUTPUT_CAPABILITIES, SELECTABLE_IMAGE_CAPABILITIES } from './WorkspacePage';

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

  it('spec enabled 能力与前端可选项 SELECTABLE_IMAGE_CAPABILITIES 一一对应（屏蔽白底/场景/换装）', () => {
    const enabledSlugs = specCaps.filter((c) => c.enabled).map((c) => c.slug).sort();
    const selectableSlugs = [...SELECTABLE_IMAGE_CAPABILITIES].sort();
    expect(enabledSlugs).toEqual(selectableSlugs);
  });

  it('L1 生成层（enabled）能力无 refImageRoles —— 图片编辑 = 通用多参考图，无角色槽位', () => {
    const l1Caps = specCaps.filter((c) => c.enabled);
    for (const cap of l1Caps) {
      expect(cap.refImageRoles, `L1 能力 ${cap.slug} 不应定义 refImageRoles`).toEqual([]);
    }
  });

  it('L2 后处理层（enabled: false）能力保留 refImageRoles 作为历史语义文档（每个角色 max >= 1）', () => {
    const l2Caps = specCaps.filter((c) => !c.enabled);
    for (const cap of l2Caps) {
      for (const r of cap.refImageRoles) {
        expect(r.max).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
