import { vi } from 'vitest';

/**
 * Drizzle ORM 链式调用 Mock 模板
 *
 * 核心设计：
 * - 链式方法（select/from/where/orderBy 等）返回 chainable 对象自身
 * - 终端方法（limit/execute/all/get/returning 等）返回 Promise
 * - mockSingle/mockEmpty/mockMany 只改终端方法，不破坏链式
 */

export interface DrizzleMock {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}

export function createDrizzleMock(): DrizzleMock {
  // 终端结果
  let terminalResult: unknown[] = [];

  const chainable = {
    // ── 查询链（链式，返回自身） ──
    select: vi.fn(() => chainable),
    from: vi.fn(() => chainable),
    where: vi.fn(() => chainable),
    whereIn: vi.fn(() => chainable),
    whereBetween: vi.fn(() => chainable),
    whereLike: vi.fn(() => chainable),
    orderBy: vi.fn(() => chainable),
    groupBy: vi.fn(() => chainable),
    having: vi.fn(() => chainable),
    offset: vi.fn(() => chainable),
    leftJoin: vi.fn(() => chainable),
    innerJoin: vi.fn(() => chainable),
    rightJoin: vi.fn(() => chainable),
    fullJoin: vi.fn(() => chainable),

    // ── 写入链（链式，返回自身） ──
    insert: vi.fn(() => chainable),
    values: vi.fn(() => chainable),
    update: vi.fn(() => chainable),
    set: vi.fn(() => chainable),
    delete: vi.fn(() => chainable),

    // ── 终端操作（返回 Promise） ──
    limit: vi.fn(() => Promise.resolve(terminalResult)),
    execute: vi.fn(() => Promise.resolve(terminalResult)),
    all: vi.fn(() => Promise.resolve(terminalResult)),
    get: vi.fn(() => Promise.resolve(terminalResult[0])),
    returning: vi.fn(() => Promise.resolve([])),
  };

  return chainable as unknown as DrizzleMock;
}

/**
 * 预设：模拟数据库查询返回空结果
 * 只改终端方法（limit/execute/all/get），不碰链式方法
 */
export function mockEmpty(db: DrizzleMock) {
  const m = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
  m.limit.mockResolvedValue([]);
  m.execute.mockResolvedValue([]);
  m.all.mockResolvedValue([]);
  m.get.mockResolvedValue(undefined);
  return db;
}

/**
 * 预设：模拟数据库查询返回单条记录
 * 只改终端方法，不碰链式方法
 */
export function mockSingle<T>(db: DrizzleMock, record: T) {
  const m = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
  m.limit.mockResolvedValue([record]);
  m.get.mockResolvedValue(record);
  m.all.mockResolvedValue([record]);
  m.execute.mockResolvedValue([record]);
  return db;
}

/**
 * 预设：模拟数据库查询返回多条记录
 * 只改终端方法，不碰链式方法
 */
export function mockMany<T>(db: DrizzleMock, records: T[]) {
  const m = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
  m.limit.mockResolvedValue(records);
  m.all.mockResolvedValue(records);
  m.execute.mockResolvedValue(records);
  return db;
}

/**
 * 预设：模拟写入操作返回结果
 */
export function mockReturning<T>(db: DrizzleMock, records: T[]) {
  const m = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
  m.returning.mockResolvedValue(records);
  return db;
}