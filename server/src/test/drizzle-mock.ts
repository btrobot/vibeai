/**
 * Drizzle ORM 链式调用 Mock 模板
 *
 * 核心设计：
 * - 链式方法（select/from/where/orderBy/limit/offset 等）返回 chainable 对象自身
 * - 终端方法（execute/all/get/returning 等）返回 Promise
 * - 支持 `await db.select().from().where()` 无显式终端方法（通过 then 方法）
 * - mockSingle/mockEmpty/mockMany 只改 _result 属性，不破坏链式
 *
 * 注意：limit 和 offset 都是链式方法（非终端），因为 Drizzle 中它们可以继续链式调用。
 * 查询执行依赖于 then 方法（await 触发）或显式终端方法（execute/all/get/returning）。
 */

import { vi } from 'vitest';

export interface DrizzleMock {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  /** 内部属性：终端结果集 */
  _result: unknown[];
  /** thenable 协议，支持 await chainable */
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => void;
}

export function createDrizzleMock(): DrizzleMock {
  const chainable: any = {
    // ── 查询链（链式，返回自身） ──
    select: vi.fn(() => chainable),
    from: vi.fn(() => chainable),
    where: vi.fn(() => chainable),
    orderBy: vi.fn(() => chainable),
    groupBy: vi.fn(() => chainable),
    having: vi.fn(() => chainable),
    leftJoin: vi.fn(() => chainable),
    innerJoin: vi.fn(() => chainable),
    rightJoin: vi.fn(() => chainable),
    fullJoin: vi.fn(() => chainable),
    offset: vi.fn(() => chainable),
    limit: vi.fn(() => chainable),

    // ── 写入链（链式，返回自身） ──
    insert: vi.fn(() => chainable),
    values: vi.fn(() => chainable),
    update: vi.fn(() => chainable),
    set: vi.fn(() => chainable),
    delete: vi.fn(() => chainable),

    // ── 事务支持 ──
    // 注: 事务回调接收的 tx 与 db 是同一个 mock 对象
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      return fn(chainable);
    }),

    // ── 终端操作（返回 Promise） ──
    execute: vi.fn(() => Promise.resolve(chainable._result ?? [])),
    all: vi.fn(() => Promise.resolve(chainable._result ?? [])),
    get: vi.fn(() => Promise.resolve((chainable._result ?? [])[0])),
    returning: vi.fn(() => Promise.resolve(chainable._result ?? [])),

    // ── thenable 协议：支持 await 无显式终端方法 ──
    // 例如: const [user] = await db.select().from(users).where(eq(...))
    then(resolve: (v: unknown) => void, _reject?: (e: unknown) => void) {
      resolve(chainable._result ?? []);
    },

    // 初始化 _result
    _result: [],
  };

  return chainable as DrizzleMock;
}

/**
 * 预设：模拟数据库查询返回空结果
 */
export function mockEmpty(db: DrizzleMock) {
  db._result = [];
  return db;
}

/**
 * 预设：模拟数据库查询返回单条记录
 */
export function mockSingle<T>(db: DrizzleMock, record: T) {
  db._result = [record];
  return db;
}

/**
 * 预设：模拟数据库查询返回多条记录
 */
export function mockMany<T>(db: DrizzleMock, records: T[]) {
  db._result = records;
  return db;
}

/**
 * 预设：模拟写入操作返回结果
 */
export function mockReturning<T>(db: DrizzleMock, records: T[]) {
  db._result = records;
  return db;
}

/**
 * 创建用于 NestJS DI 注入的 mock（非 thenable）
 *
 * 注意：createDrizzleMock() 返回的 db 对象带有 then 方法，
 * NestJS 的 Test.createTestingModule 会检测到 thenable 对象并自动 await 它，
 * 导致 db 被解析为 _result 数组而非原始对象。
 *
 * 此函数移除 then 方法，确保 NestJS DI 注入正常工作。
 * 链式方法的中间结果（select().from().where() 等）仍然保持 thenable，
 * 因为终端方法（limit/execute/all/returning）返回的是 Promise。
 */
export function createDrizzleMockForNestJS(): DrizzleMock {
  const db = createDrizzleMock();
  // 创建代理对象，委托所有属性到原始 chainable，但隐藏 then 方法
  // 不能使用 Proxy（NestJS 会破坏），也不能删除 then（破坏 await 链）
  const proxy: any = {};
  for (const key of Object.keys(db)) {
    if (key === 'then') continue;
    Object.defineProperty(proxy, key, {
      get: () => (db as any)[key],
      set: (v) => { (db as any)[key] = v; },
      enumerable: true,
      configurable: true,
    });
  }
  return proxy as DrizzleMock;
}