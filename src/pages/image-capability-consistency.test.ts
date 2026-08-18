/**
 * image-capability-consistency.test.ts
 *
 * 防漂移测试：前端 REF_IMAGE_ROLES 与 specs/gateway.spec.yaml 的
 * seed_data.capabilities.refImageRoles（Spec SOT）双向一一对应。
 * 新增/修改图片能力槽位角色时，改 spec 不改代码（或反之）会在此测试变红。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { IMAGE_OUTPUT_CAPABILITIES, REF_IMAGE_ROLES, SELECTABLE_IMAGE_CAPABILITIES } from './WorkspacePage';

interface SpecRefRole { role: string; label: string; max: number }
interface SpecCapabilitySeed { slug: string; enabled: boolean; refImageRoles: SpecRefRole[] }

describe('图片能力 refImageRoles Spec 一致性（gateway.spec.yaml = SOT）', () => {
  let specCaps: SpecCapabilitySeed[];

  beforeAll(() => {
    const specPath = path.resolve(__dirname, '../../specs/gateway.spec.yaml');
    const spec = yaml.load(fs.readFileSync(specPath, 'utf8')) as Record<string, unknown>;
    const seedData = spec.seed_data as { capabilities: SpecCapabilitySeed[] };
    specCaps = seedData.capabilities;
  });

  it('spec capabilities 清单与 IMAGE_OUTPUT_CAPABILITIES 一一对应', () => {
    const specSlugs = specCaps.map((c) => c.slug).sort();
    const codeSlugs = [...IMAGE_OUTPUT_CAPABILITIES].sort();
    expect(specSlugs).toEqual(codeSlugs);
  });

  it('每个能力的 refImageRoles 与代码 REF_IMAGE_ROLES 双向一致（role+label+max 元组）', () => {
    for (const cap of specCaps) {
      const specRoles = cap.refImageRoles.map((r) => `${r.role}|${r.label}|${r.max}`).sort();
      const codeRoles = (REF_IMAGE_ROLES[cap.slug] ?? []).map((r) => `${r.role}|${r.label}|${r.max}`).sort();
      expect(specRoles, `能力 ${cap.slug} 的 refImageRoles 与代码不一致`).toEqual(codeRoles);
    }
  });

  it('REF_IMAGE_ROLES 不包含 spec 未定义的能力', () => {
    const specSlugSet = new Set(specCaps.map((c) => c.slug));
    for (const slug of Object.keys(REF_IMAGE_ROLES)) {
      expect(specSlugSet.has(slug)).toBe(true);
    }
  });

  it('spec enabled 能力与前端可选项 SELECTABLE_IMAGE_CAPABILITIES 一一对应（屏蔽白底/场景/换装）', () => {
    const enabledSlugs = specCaps.filter((c) => c.enabled).map((c) => c.slug).sort();
    const selectableSlugs = [...SELECTABLE_IMAGE_CAPABILITIES].sort();
    expect(enabledSlugs).toEqual(selectableSlugs);
  });

  it('每个角色 max >= 1', () => {
    for (const cap of specCaps) {
      for (const r of cap.refImageRoles) {
        expect(r.max).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
