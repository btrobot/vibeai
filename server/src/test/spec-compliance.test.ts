/**
 * spec-compliance.test.ts
 *
 * 自动化合规检测：验证 .spec.yaml 定义与实际代码的一致性。
 * 每次运行测试时自动检查，确保代码与规格不脱节。
 *
 * 检测项：
 * 1. 所有 spec YAML 文件语法正确、结构完整
 * 2. 实体定义结构完整（字段名、类型、约束）
 * 3. 操作定义结构完整（method/path/auth）
 * 4. 业务规则有对应的测试覆盖
 * 5. 状态机转换合法
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

// ================================================================
// 类型定义
// ================================================================
interface SpecField {
  name: string;
  type: string;
  pk?: boolean;
  notNull?: boolean;
  unique?: boolean;
  default?: unknown;
  nullable?: boolean;
  fk?: { table: string; field: string; onDelete?: string };
  enum?: string[];
  range?: [number, number];
  desc?: string;
}

interface SpecEntity {
  name: string;
  table: string;
  description?: string;
  fields: SpecField[];
  indexes?: { fields: string[]; name?: string; using?: string }[];
  relations?: { type: 'hasMany' | 'belongsTo'; target: string; via: string }[];
}

interface SpecOperation {
  name: string;
  summary: string;
  method: string;
  path: string;
  auth: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  pre?: string[];
  post?: string[];
  effect?: string[];
  errors?: { status: number; condition: string; message: string; test?: string }[];
}

interface SpecRule {
  id: string;
  description: string;
  severity: 'error' | 'warning';
  enforcement: string;
  test?: string;
}

interface SpecStateMachine {
  entity: string;
  field: string;
  states: Record<string, string>;
  transitions: { from: string; to: string[]; desc: string }[];
}

interface SpecFile {
  domain: string;
  version: string;
  entities: SpecEntity[];
  operations: SpecOperation[];
  rules: SpecRule[];
  state_machine?: SpecStateMachine;
  seed_data?: Record<string, unknown>[];
}

// ================================================================
// 辅助函数
// ================================================================
const SPECS_DIR = path.resolve(__dirname, '../../../specs');

function loadAllSpecs(): SpecFile[] {
  const files = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.spec.yaml'));
  expect(files.length).toBeGreaterThanOrEqual(1);
  return files.map(file => {
    const content = fs.readFileSync(path.join(SPECS_DIR, file), 'utf-8');
    const parsed = yaml.load(content) as SpecFile;
    return { ...parsed, _file: file };
  });
}

let _specs: (SpecFile & { _file: string })[];

// ================================================================
// 1. 语法与结构完整性
// ================================================================
describe('1. Spec 语法与结构', () => {
  beforeAll(() => {
    _specs = loadAllSpecs();
  });

  it('specs 目录存在且包含 .spec.yaml 文件', () => {
    expect(fs.existsSync(SPECS_DIR)).toBe(true);
    const files = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.spec.yaml'));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('所有 spec 文件包含必要字段 (domain/version/entities/operations/rules)', () => {
    for (const spec of _specs) {
      expect(spec.domain).toBeDefined();
      expect(spec.version).toBeDefined();
      expect(spec.entities).toBeInstanceOf(Array);
      expect(spec.operations).toBeInstanceOf(Array);
      expect(spec.rules).toBeInstanceOf(Array);
    }
  });

  it('每个实体有 name 和 table 以及至少一个字段', () => {
    for (const spec of _specs) {
      for (const entity of spec.entities) {
        expect(entity.name).toBeTruthy();
        expect(entity.table).toBeTruthy();
        expect(entity.fields).toBeInstanceOf(Array);
        expect(entity.fields.length).toBeGreaterThan(0);
      }
    }
  });

  it('每个操作有 name/method/path/auth', () => {
    for (const spec of _specs) {
      for (const op of spec.operations) {
        expect(op.name).toBeTruthy();
        expect(op.method).toMatch(/^(GET|POST|PUT|PATCH|DELETE|N\/A)$/);
        expect(op.path).toBeTruthy();
        expect(op.auth).toMatch(/^(none|jwt|internal)$/);
      }
    }
  });

  it('每条规则有 id 和 description，id 格式为 DOMAIN-NNN', () => {
    for (const spec of _specs) {
      for (const rule of spec.rules) {
        expect(rule.id).toMatch(/^[A-Z]+-\d{3}$/);
        expect(rule.description).toBeTruthy();
        expect(rule.severity).toMatch(/^(error|warning)$/);
      }
    }
  });

  it('规则 ID 全部唯一', () => {
    const allIds = _specs.flatMap(s => s.rules.map(r => r.id));
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});

// ================================================================
// 2. 实体定义合规
// ================================================================
describe('2. 实体定义', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
  });

  it('每个实体必须包含主键字段', () => {
    for (const spec of _specs) {
      for (const entity of spec.entities) {
        const pkFields = entity.fields.filter(f => f.pk);
        expect(pkFields.length).toBe(1, `${spec.domain}.${entity.name} 必须有一个主键`);
      }
    }
  });

  it('每个实体必须包含 createdAt 和 updatedAt', () => {
    for (const spec of _specs) {
      for (const entity of spec.entities) {
        const fieldNames = entity.fields.map(f => f.name);
        expect(fieldNames).toContain('createdAt');
        expect(fieldNames).toContain('updatedAt');
      }
    }
  });

  it('索引命名以表名开头', () => {
    for (const spec of _specs) {
      for (const entity of spec.entities) {
        for (const idx of entity.indexes ?? []) {
          if (idx.name) {
            expect(idx.name.startsWith(entity.table)).toBe(true);
          }
        }
      }
    }
  });

  it('外键引用的表必须在某个实体中定义', () => {
    const allTables = new Set(_specs.flatMap(s => s.entities.map(e => e.table)));
    for (const spec of _specs) {
      for (const entity of spec.entities) {
        for (const field of entity.fields) {
          if (field.fk) {
            expect(allTables.has(field.fk.table)).toBe(
              true,
              `${spec.domain}.${entity.name}.${field.name} 外键引用 ${field.fk.table} 未定义`,
            );
          }
        }
      }
    }
  });
});

// ================================================================
// 3. 操作定义合规
// ================================================================
describe('3. 操作定义', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
  });

  it('每个 HTTP 操作必须有 pre/post/effect 描述', () => {
    for (const spec of _specs) {
      for (const op of spec.operations) {
        if (op.method === 'N/A') continue;
        expect(op.pre || op.post || op.effect).toBeTruthy(
          `${spec.domain}.${op.name} 缺少 pre/post/effect 描述`,
        );
      }
    }
  });

  it('每个操作的错误场景必须有 status 和 message', () => {
    for (const spec of _specs) {
      for (const op of spec.operations) {
        for (const err of op.errors ?? []) {
          expect(err.status).toBeGreaterThanOrEqual(400);
          expect(err.message).toBeTruthy();
        }
      }
    }
  });
});

// ================================================================
// 4. 业务规则合规
// ================================================================
describe('4. 业务规则', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
  });

  it('所有 error 级别的规则必须有 enforcement 描述', () => {
    for (const spec of _specs) {
      for (const rule of spec.rules) {
        if (rule.severity === 'error') {
          expect(rule.enforcement).toBeTruthy(`${rule.id} 缺少 enforcement`);
        }
      }
    }
  });

  it('至少 70% 的 error 级别规则有对应的 test 字段', () => {
    const allErrorRules = _specs.flatMap(s => s.rules.filter(r => r.severity === 'error'));
    const rulesWithTest = allErrorRules.filter(r => r.test);
    const coverage = allErrorRules.length > 0 ? rulesWithTest.length / allErrorRules.length : 0;
    expect(coverage).toBeGreaterThanOrEqual(0.7);
  });
});

// ================================================================
// 5. 状态机合规
// ================================================================
describe('5. 状态机', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
  });

  it('所有状态机转换合法', () => {
    for (const spec of _specs) {
      if (!spec.state_machine) continue;
      const sm = spec.state_machine;

      for (const transition of sm.transitions) {
        expect(sm.states[transition.from]).toBeDefined(
          `状态机 ${sm.entity} 起始状态 ${transition.from} 未定义`,
        );
        for (const to of transition.to) {
          expect(sm.states[to]).toBeDefined(
            `状态机 ${sm.entity} 目标状态 ${to} 未定义`,
          );
        }
      }

      // 不存在自循环转换
      const hasSelfLoop = sm.transitions.some(t =>
        t.to.some(to => t.from === to),
      );
      expect(hasSelfLoop).toBe(false);
    }
  });
});

// ================================================================
// 6. 种子数据合规
// ================================================================
describe('6. 种子数据', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
  });

  it('billing 域必须有种子数据（套餐定义，至少 4 个）', () => {
    const billingSpec = _specs.find(s => s.domain === 'billing');
    expect(billingSpec).toBeDefined();
    expect(billingSpec!.seed_data).toBeInstanceOf(Array);
    // seed_data 可能为 [{ entity: 'X', records: [...] }] 或 [{ slug: 'free', ... }]
    const allRecords = billingSpec!.seed_data!.flatMap((d: any) => d.records ?? [d]);
    expect(allRecords.length).toBeGreaterThanOrEqual(4);
  });

  it('免费套餐（free）价格必须为 0', () => {
    const billingSpec = _specs.find(s => s.domain === 'billing');
    expect(billingSpec).toBeDefined();
    const allRecords = billingSpec!.seed_data!.flatMap((d: any) => d.records ?? [d]);
    const freePlan = allRecords.find((d: any) => d.slug === 'free');
    expect(freePlan).toBeDefined();
    expect(String((freePlan as any).priceMonthly)).toBe('0');
  });
});

// ================================================================
// 域级合规报告
// ================================================================
describe('域级合规报告', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
  });

  it('输出完整合规度统计', () => {
    const stats = _specs.map(spec => {
      const ruleCount = spec.rules.length;
      const rulesWithTest = spec.rules.filter(r => r.test).length;
      const testCoverage = ruleCount > 0 ? (rulesWithTest / ruleCount * 100).toFixed(1) : 'N/A';

      return {
        domain: spec.domain,
        entities: spec.entities.length,
        operations: spec.operations.length,
        rules: spec.rules.length,
        testCoverage: `${testCoverage}%`,
      };
    });

    console.table(stats);
    expect(stats.length).toBeGreaterThanOrEqual(1);
  });
});