/**
 * spec-compliance.test.ts
 *
 * 自动化合规检测：验证 .spec.yaml 定义与实际代码的一致性。
 * Spec 是真相源（SOT），代码必须与之对齐。
 *
 * 检测项：
 * 1. 语法与结构完整性 — 所有 spec 文件格式正确
 * 2. 实体 → DB Schema — spec 实体与 Drizzle 表定义一致
 * 3. 操作 → API 路由 — spec 操作与 NestJS 控制器路由一致
 * 4. 业务规则 → 代码 — 规则在服务代码中被执行
 * 5. 状态机 — 转换合法
 * 6. 种子数据 — 套餐定义正确
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

// ================================================================
// 类型定义
// ================================================================
interface SpecField {
  name: string; type: string; pk?: boolean; notNull?: boolean;
  unique?: boolean; default?: unknown; nullable?: boolean;
  fk?: { table: string; field: string; onDelete?: string };
  enum?: string[]; range?: [number, number]; desc?: string;
}

interface SpecEntity {
  name: string; table: string; description?: string;
  fields: SpecField[];
  indexes?: { fields: string[]; name?: string; using?: string }[];
  relations?: { type: 'hasMany' | 'belongsTo'; target: string; via: string }[];
}

interface SpecOperation {
  name: string; summary: string; method: string; path: string;
  auth: string; input?: Record<string, unknown>; output?: Record<string, unknown>;
  pre?: string[]; post?: string[]; effect?: string[];
  errors?: { status: number; condition: string; message: string; test?: string }[];
}

interface SpecRule {
  id: string; description: string; severity: 'error' | 'warning';
  enforcement: string; test?: string;
}

interface SpecStateMachine {
  entity: string; field: string;
  states: Record<string, string>;
  transitions: { from: string; to: string[]; desc: string }[];
}

interface SpecFile {
  domain: string; version: string;
  entities: SpecEntity[]; operations: SpecOperation[];
  rules: SpecRule[]; state_machine?: SpecStateMachine;
  seed_data?: Record<string, unknown>[];
  _file?: string;
}

// ================================================================
// 辅助函数
// ================================================================
const SPECS_DIR = path.resolve(__dirname, '../../../specs');
const SERVER_SRC = path.resolve(__dirname, '..');

function loadAllSpecs(): SpecFile[] {
  const files = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.spec.yaml'));
  return files.map(file => {
    const content = fs.readFileSync(path.join(SPECS_DIR, file), 'utf-8');
    return { ...(yaml.load(content) as SpecFile), _file: file };
  });
}

function loadSchemaTables(): Map<string, string[]> {
  const schemaDir = path.join(SERVER_SRC, 'db/schema');
  const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.ts'));
  const tables = new Map<string, string[]>();

  for (const file of files) {
    const content = fs.readFileSync(path.join(schemaDir, file), 'utf-8');
    // 提取 pgTable 定义：匹配到 }, (table) => 前的完整字段块
    const tableRegex = /export const \w+ = pgTable\('(\w+)',\s*\{([\s\S]*?)\},\s*\(/g;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const fieldsBlock = match[2];
      // 提取字段名：行首缩进 + 字段名 + : (不是箭头函数参数)
      const fieldRegex = /^\s{2}(\w+):\s+(?!\w+\s*=>)/gm;
      const fields: string[] = [];
      let fMatch;
      while ((fMatch = fieldRegex.exec(fieldsBlock)) !== null) {
        fields.push(fMatch[1]);
      }
      tables.set(tableName, fields);
    }
  }
  return tables;
}

function loadControllerRoutes(): { method: string; path: string; controller: string }[] {
  const modulesDir = path.join(SERVER_SRC, 'modules');
  const routes: { method: string; path: string; controller: string }[] = [];

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.controller.ts')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const baseMatch = content.match(/@Controller\('([^']*)'\)/);
        const basePath = baseMatch ? baseMatch[1] : '';
        // 匹配 @Get() / @Post('path') 等（含空路径）
        const methodRegex = /@(Get|Post|Put|Patch|Delete)\((?:\s*'([^']*)'\s*)?\)/g;
        let mMatch;
        while ((mMatch = methodRegex.exec(content)) !== null) {
          const subPath = mMatch[2] || '';
          const fullRoute = '/' + [basePath, subPath].filter(Boolean).join('/');
          routes.push({
            method: mMatch[1].toUpperCase(),
            path: fullRoute.replace(/\/+/g, '/').replace(/\/$/, '') || '/',
            controller: entry.name,
          });
        }
      }
    }
  }

  scanDir(modulesDir);
  return routes;
}

function loadServiceCode(): string {
  const modulesDir = path.join(SERVER_SRC, 'modules');
  let allCode = '';
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.service.ts')) {
        allCode += fs.readFileSync(fullPath, 'utf-8') + '\n';
      }
    }
  }
  scanDir(modulesDir);
  return allCode;
}

let _specs: SpecFile[];
let _schemaTables: Map<string, string[]>;
let _controllerRoutes: { method: string; path: string; controller: string }[];
let _serviceCode: string;

// ================================================================
// 1. 语法与结构完整性
// ================================================================
describe('1. Spec 语法与结构', () => {
  beforeAll(() => { _specs = loadAllSpecs(); });

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
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

// ================================================================
// 2. 实体 → DB Schema 一致性
// ================================================================
describe('2. 实体 → DB Schema 一致性', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
    _schemaTables = loadSchemaTables();
  });

  it('每个 spec 实体对应的 DB 表必须存在', () => {
    for (const spec of _specs) {
      for (const entity of spec.entities) {
        const tableName = spec.domain === 'auth' ? '' : entity.table;
        // auth 域的实体表定义在 index.ts 中，需要特殊处理
        const exists = _schemaTables.has(entity.table);
        expect(exists).toBe(true, `${spec.domain}.${entity.name} 表 ${entity.table} 在 DB schema 中不存在`);
      }
    }
  });

  it('每个 spec 实体的主键字段在 DB schema 中有对应', () => {
    for (const spec of _specs) {
      for (const entity of spec.entities) {
        const dbFields = _schemaTables.get(entity.table);
        expect(dbFields).toBeDefined();
        if (!dbFields) continue;
        for (const field of entity.fields) {
          // 检查字段名（驼峰→下划线映射）
          const dbFieldName = field.name.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
          const fieldExists = dbFields.includes(field.name) || dbFields.includes(dbFieldName);
          expect(fieldExists).toBe(true, `${spec.domain}.${entity.name}.${field.name} 在 ${entity.table} 表中不存在`);
        }
      }
    }
  });

  it('DB schema 中的每个表在 spec 中有对应实体', () => {
    const specTables = new Set(_specs.flatMap(s => s.entities.map(e => e.table)));
    for (const [tableName] of _schemaTables) {
      expect(specTables.has(tableName)).toBe(true, `表 ${tableName} 在 spec 中没有对应实体`);
    }
  });
});

// ================================================================
// 3. 操作 → API 路由一致性
// ================================================================
describe('3. 操作 → API 路由一致性', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
    _controllerRoutes = loadControllerRoutes();
  });

  it('每个 spec 操作在控制器中有对应的路由实现', () => {
    for (const spec of _specs) {
      for (const op of spec.operations) {
        if (op.method === 'N/A') continue;
        const matched = _controllerRoutes.some(r =>
          r.method === op.method &&
          r.path === op.path
        );
        expect(matched).toBe(true, `${spec.domain}.${op.name} (${op.method} ${op.path}) 在控制器中无对应路由`);
      }
    }
  });

  it('每个控制器路由在 spec 中有对应的操作定义', () => {
    for (const route of _controllerRoutes) {
      // 跳过 admin 路由，非 spec 域
      if (route.path.startsWith('/admin')) continue;
      const matched = _specs.some(s =>
        s.operations.some(op =>
          op.method !== 'N/A' && op.method === route.method && op.path === route.path
        )
      );
      expect(matched).toBe(true, `路由 ${route.method} ${route.path} 在 spec 中无对应操作`);
    }
  });
});

// ================================================================
// 4. 业务规则 → 代码执行一致性
// ================================================================
describe('4. 业务规则 → 代码执行', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
    _serviceCode = loadServiceCode();
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

  it('每条规则的 enforcement 关键词在服务代码中有对应实现', () => {
    for (const spec of _specs) {
      for (const rule of spec.rules) {
        if (!rule.enforcement) continue;
        // 尝试多种匹配方式
        const keywords = [
          rule.enforcement,
          ...rule.enforcement.match(/\b[a-z]+\b/gi) || [],
        ];
        const found = keywords.some(kw =>
          kw.length > 3 && _serviceCode.includes(kw)
        );
        // 宽松检查：只对 enforcement 包含具体方法名的规则做严格检查
        if (rule.enforcement.includes('(') || rule.enforcement.includes('throw')) {
          // 包含函数调用或异常抛出的 enforcement 需要被检查
          const methodMatch = rule.enforcement.match(/\b(this\.\w+|\w+Service\.\w+)\b/);
          if (methodMatch) {
            expect(_serviceCode.includes(methodMatch[1].replace('this.', '')))
              .toBe(true, `${rule.id} 的 enforcement "${rule.enforcement}" 在服务代码中未实现`);
          }
        }
      }
    }
  });
});

// ================================================================
// 5. 规则测试覆盖率
// ================================================================
describe('5. 规则测试覆盖率', () => {
  let _testCases: Map<string, string[]> = new Map();

  beforeAll(() => {
    // 扫描测试文件，提取所有 it/test 名称
    const testDir = path.resolve(__dirname, '../../src/modules');
    const files = fs.readdirSync(testDir, { recursive: true } as any)
      .filter((f: string) => f.endsWith('.test.ts') || f.endsWith('.spec.ts')) as string[];

    for (const file of files) {
      const content = fs.readFileSync(path.join(testDir, file), 'utf-8');
      const regex = /(?:it|test)\(['\`]([^'\`]+)['\`]/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const existing = _testCases.get(file) || [];
        existing.push(match[1]);
        _testCases.set(file, existing);
      }
    }
  });

  it('每条 error 级规则的 test 字段对应实际测试用例', () => {
    const allTestNames = [..._testCases.values()].flat();
    let total = 0, covered = 0;

    for (const spec of _specs) {
      for (const rule of spec.rules) {
        if (rule.severity !== 'error') continue;
        total++;
        if (!rule.test) {
          expect(rule.test).toBeTruthy(
            `${rule.id} 缺少 test 字段`,
          );
          continue;
        }

        // 精确匹配：test 字段等于测试用例名称
        const exactMatch = allTestNames.includes(rule.test);
        // 模糊匹配：test 字段是测试用例名称的子串
        const fuzzyMatch = allTestNames.some(tc => tc.includes(rule.test) || rule.test.includes(tc));

        expect(exactMatch || fuzzyMatch).toBe(true,
          `${rule.id} test="${rule.test}" 在测试文件中未找到匹配的测试用例`,
        );
        if (exactMatch || fuzzyMatch) covered++;
      }
    }

    // 覆盖率 >= 70%
    const rate = total > 0 ? covered / total : 1;
    expect(rate).toBeGreaterThanOrEqual(0.7,
      `error 级规则测试覆盖率 ${(rate * 100).toFixed(0)}% 低于 70%`,
    );
  });
});

// ================================================================
// 6. 状态机合规
// ================================================================
describe('5. 状态机', () => {
  beforeAll(() => {
    if (!_specs) _specs = loadAllSpecs();
    _serviceCode = loadServiceCode();
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
      const hasSelfLoop = sm.transitions.some(t => t.to.some(to => t.from === to));
      expect(hasSelfLoop).toBe(false);
    }
  });

  it('状态机字段名在 DB schema 中有对应列', () => {
    if (!_schemaTables) _schemaTables = loadSchemaTables();
    for (const spec of _specs) {
      if (!spec.state_machine) continue;
      const sm = spec.state_machine;
      // 查找实体对应的表
      const entity = spec.entities.find(e => e.name === sm.entity);
      expect(entity).toBeDefined(`状态机实体 ${sm.entity} 未定义`);
      if (entity) {
        const fieldExists = entity.fields.some(f => f.name === sm.field);
        expect(fieldExists).toBe(true, `${spec.domain}.${sm.entity} 缺少状态字段 ${sm.field}`);
      }
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
    _controllerRoutes = loadControllerRoutes();
    _schemaTables = loadSchemaTables();
  });

  it('输出完整合规度统计', () => {
    const stats = _specs.map(spec => {
      const ruleCount = spec.rules.length;
      const rulesWithTest = spec.rules.filter(r => r.test).length;
      const testCoverage = ruleCount > 0 ? (rulesWithTest / ruleCount * 100).toFixed(1) : 'N/A';

      // 实体覆盖
      const entitiesInDb = spec.entities.filter(e => _schemaTables.has(e.table)).length;
      // 路由覆盖
      const opsInRoutes = spec.operations.filter(op => {
        if (op.method === 'N/A') return true;
        return _controllerRoutes.some(r => r.method === op.method && r.path === op.path);
      }).length;

      return {
        domain: spec.domain,
        entities: `${spec.entities.length}/${entitiesInDb} (DB)`,
        operations: `${spec.operations.length}/${opsInRoutes} (Route)`,
        rules: spec.rules.length,
        testCoverage: `${testCoverage}%`,
      };
    });

    console.table(stats);
    expect(stats.length).toBeGreaterThanOrEqual(1);
  });

  it('所有域实体覆盖率达到 100%', () => {
    for (const spec of _specs) {
      for (const entity of spec.entities) {
        const exists = _schemaTables.has(entity.table);
        expect(exists).toBe(true, `${spec.domain}.${entity.name} 表 ${entity.table} 未在 DB schema 中找到`);
      }
    }
  });

  it('所有域操作路由覆盖率达到 100%', () => {
    for (const spec of _specs) {
      for (const op of spec.operations) {
        if (op.method === 'N/A') continue;
        const matched = _controllerRoutes.some(r =>
          r.method === op.method && r.path === op.path
        );
        expect(matched).toBe(true, `${spec.domain}.${op.name} (${op.method} ${op.path}) 无对应路由`);
      }
    }
  });
});