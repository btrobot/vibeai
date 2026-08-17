import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateService } from './create.service';
import { createDrizzleMockForNestJS } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ===== Type-safe mock record factory =====

interface TestCreateRecord {
  id: string;
  projectId: string;
  userId: string;
  capabilitySlug: string;
  prompt: string;
  input: Record<string, unknown>;
  sourceCreateId: string | null;
  status: string;
  output: Record<string, unknown> | null;
  modelSlug: string | null;
  taskCount: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TestTaskRecord {
  id: string;
  createId: string | null;
  projectId: string;
  userId: string;
  capabilitySlug: string;
  status: string;
  progress: number;
  inputParams: Record<string, unknown>;
  outputUrls: string[];
  errorMessage: string | null;
  creditsCost: number;
  modelSlug: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function buildCreateRecord(partial?: Partial<TestCreateRecord>): TestCreateRecord {
  return {
    id: 'create-1',
    projectId: 'proj-1',
    userId: 'user-1',
    capabilitySlug: 'image-generation',
    prompt: '一只猫',
    input: { prompt: '一只猫' },
    sourceCreateId: null,
    status: 'draft',
    output: null,
    modelSlug: 'doubao-seedream-5-0',
    taskCount: 0,
    errorMessage: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

function buildTaskRecord(partial?: Partial<TestTaskRecord>): TestTaskRecord {
  return {
    id: 'task-1',
    createId: 'create-1',
    projectId: 'proj-1',
    userId: 'user-1',
    capabilitySlug: 'image-generation',
    status: 'queued',
    progress: 0,
    inputParams: { prompt: '一只猫' },
    outputUrls: [],
    errorMessage: null,
    creditsCost: 10,
    modelSlug: 'doubao-seedream-5-0',
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

/**
 * Sequential mock: returns different results for each await (then) call.
 * Used for service methods that make multiple sequential DB queries.
 */
function createSequentialDbMock(resultQueue: unknown[][]) {
  let callIndex = 0;
  const chainable: any = {
    select: vi.fn(() => chainable),
    from: vi.fn(() => chainable),
    where: vi.fn(() => chainable),
    orderBy: vi.fn(() => chainable),
    groupBy: vi.fn(() => chainable),
    having: vi.fn(() => chainable),
    leftJoin: vi.fn(() => chainable),
    innerJoin: vi.fn(() => chainable),
    offset: vi.fn(() => chainable),
    limit: vi.fn(() => chainable),
    insert: vi.fn(() => chainable),
    values: vi.fn(() => chainable),
    update: vi.fn(() => chainable),
    set: vi.fn(() => chainable),
    delete: vi.fn(() => chainable),
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(chainable)),
    execute: vi.fn(() => Promise.resolve(resultQueue[callIndex++] ?? [])),
    all: vi.fn(() => Promise.resolve(resultQueue[callIndex++] ?? [])),
    get: vi.fn(() => Promise.resolve((resultQueue[callIndex++] ?? [])[0])),
    returning: vi.fn(() => Promise.resolve(resultQueue[callIndex++] ?? [])),
    then(resolve: (v: unknown) => void) {
      resolve(resultQueue[callIndex++] ?? []);
    },
    _result: [],
  };
  return chainable;
}

describe('CreateService', () => {
  let service: CreateService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;
  let storageService: { resolveUrls: ReturnType<typeof vi.fn>; resolveUrl: ReturnType<typeof vi.fn> };

  let projectService: { updateCreateCounts: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    storageService = {
      resolveUrls: vi.fn().mockResolvedValue(new Map<string, string>()),
      resolveUrl: vi.fn().mockResolvedValue(null),
    };
    projectService = {
      updateCreateCounts: vi.fn().mockResolvedValue(undefined),
    };
    service = new CreateService(db as any, storageService as any, projectService as any);
  });

  // ============================================================
  // createCreate
  // ============================================================
  describe('createCreate', () => {
    it('应成功创建 Create 记录并返回 id', async () => {
      const record = buildCreateRecord();
      db._result = [record];

      const result = await service.createCreate({
        projectId: 'proj-1',
        userId: 'user-1',
        capabilitySlug: 'image-generation',
        prompt: '一只猫',
        modelSlug: 'doubao-seedream-5-0',
      });

      expect(result.id).toBe('create-1');
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalled();
      expect(db.returning).toHaveBeenCalled();
    });

    it('sourceCreateId 为 null 时表示原创创作', async () => {
      const record = buildCreateRecord({ sourceCreateId: null });
      db._result = [record];

      const result = await service.createCreate({
        projectId: 'proj-1',
        userId: 'user-1',
        capabilitySlug: 'image-generation',
        prompt: '一只猫',
      });

      expect(result.id).toBeDefined();
    });

    it('sourceCreateId 非空时表示修改/迭代创作', async () => {
      const record = buildCreateRecord({ sourceCreateId: 'create-0' });
      db._result = [record];

      const result = await service.createCreate({
        projectId: 'proj-1',
        userId: 'user-1',
        capabilitySlug: 'image-generation',
        prompt: '更亮的颜色',
        sourceCreateId: 'create-0',
      });

      expect(result.id).toBeDefined();
    });

    it('创建后重算项目创作计数（updateCreateCounts）', async () => {
      db._result = [buildCreateRecord({})];

      const result = await service.createCreate({
        projectId: 'proj-1',
        userId: 'user-1',
        capabilitySlug: 'text-generation',
        prompt: 'hi',
      });

      expect(result.id).toBeTruthy();
      expect(projectService.updateCreateCounts).toHaveBeenCalledWith('proj-1');
    });
  });

  // ============================================================
  // updateStatus
  // ============================================================
  describe('updateStatus', () => {
    it('应更新 Create 状态', async () => {
      await service.updateStatus('create-1', 'processing');

      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });

    it('应同时更新 output（completed 时）', async () => {
      const output = { imageUrl: 'https://cdn.vibeai.com/result.png' };
      await service.updateStatus('create-1', 'completed', { output });

      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
    });

    it('应同时更新 errorMessage（failed 时）', async () => {
      await service.updateStatus('create-1', 'failed', { errorMessage: 'SDK timeout' });

      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
    });

    it('状态更新后重算项目创作计数（updateCreateCounts）', async () => {
      const seqDb = createSequentialDbMock([
        [],                        // updateStatus: update then
        [{ projectId: 'proj-9' }], // updateStatus: select projectId
      ]);
      const s = new CreateService(seqDb as any, storageService as any, projectService as any);

      await s.updateStatus('create-1', 'completed');

      expect(projectService.updateCreateCounts).toHaveBeenCalledWith('proj-9');
    });
  });

  // ============================================================
  // incrementTaskCount
  // ============================================================
  describe('incrementTaskCount', () => {
    it('应递增 taskCount（SQL +1）', async () => {
      await service.incrementTaskCount('create-1');

      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });
  });

  // ============================================================
  // syncCreateStatus (ENG-012)
  // ============================================================
  describe('syncCreateStatus (ENG-012)', () => {
    it('should sync create status when task completes', async () => {
      const updateSpy = vi.spyOn(service, 'updateStatus');

      await service.syncCreateStatus('create-1', 'completed', { imageUrl: 'https://cdn.vibeai.com/result.png' });

      expect(updateSpy).toHaveBeenCalledWith(
        'create-1',
        'completed',
        { output: { imageUrl: 'https://cdn.vibeai.com/result.png' } },
      );
    });

    it('task failed 时应同步为 failed 并传递 errorMessage', async () => {
      const updateSpy = vi.spyOn(service, 'updateStatus');

      await service.syncCreateStatus('create-1', 'failed', undefined, 'SDK timeout');

      expect(updateSpy).toHaveBeenCalledWith(
        'create-1',
        'failed',
        { errorMessage: 'SDK timeout' },
      );
    });

    it('task cancelled 时应同步为 cancelled', async () => {
      const updateSpy = vi.spyOn(service, 'updateStatus');

      await service.syncCreateStatus('create-1', 'cancelled');

      expect(updateSpy).toHaveBeenCalledWith('create-1', 'cancelled', {});
    });

    it('task queued/submitting/completing 时应同步为 processing', async () => {
      const updateSpy = vi.spyOn(service, 'updateStatus');

      await service.syncCreateStatus('create-1', 'queued');
      expect(updateSpy).toHaveBeenCalledWith('create-1', 'processing', {});

      await service.syncCreateStatus('create-1', 'submitting');
      expect(updateSpy).toHaveBeenCalledWith('create-1', 'processing', {});

      await service.syncCreateStatus('create-1', 'completing');
      expect(updateSpy).toHaveBeenCalledWith('create-1', 'processing', {});
    });

    it('未知 task 状态时应跳过（不调用 updateStatus）', async () => {
      const updateSpy = vi.spyOn(service, 'updateStatus');

      await service.syncCreateStatus('create-1', 'unknown-status');

      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // getCreate (uses sequential mock for multi-query)
  // ============================================================
  describe('getCreate', () => {
    it('应返回 Create 详情含 latest task 状态', async () => {
      const record = buildCreateRecord({ status: 'processing' });
      const task = buildTaskRecord({ status: 'submitting', progress: 50 });
      const seqDb = createSequentialDbMock([[record], [task]]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      const result = await seqService.getCreate('create-1', 'user-1');

      expect(result.id).toBe('create-1');
      expect(result.taskStatus).toBe('submitting');
      expect(result.taskProgress).toBe(50);
    });

    it('should throw NotFoundException when create not found', async () => {
      db._result = [];

      await expect(service.getCreate('non-existent', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('无关联 task 时 taskStatus 为 null', async () => {
      const record = buildCreateRecord({ status: 'draft' });
      const seqDb = createSequentialDbMock([[record], []]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      const result = await seqService.getCreate('create-1', 'user-1');

      expect(result.taskStatus).toBeNull();
      expect(result.taskProgress).toBe(0);
    });
  });

  // ============================================================
  // retryCreate (uses getCreate internally)
  // ============================================================
  describe('retryCreate', () => {
    it('failed 状态的 Create 可以重试', async () => {
      const failedRecord = buildCreateRecord({ status: 'failed', errorMessage: 'SDK timeout' });
      const processingRecord = buildCreateRecord({ status: 'processing' });
      // retryCreate calls: getCreate(2 queries), updateStatus(update + select projectId), getCreate(2 queries)
      const seqDb = createSequentialDbMock([
        [failedRecord],            // 1st getCreate: create query
        [],                        // 1st getCreate: task query
        [],                        // updateStatus: update then
        [{ projectId: 'proj-1' }], // updateStatus: select projectId（重算计数）
        [processingRecord],        // 2nd getCreate: create query (after update)
        [],                        // 2nd getCreate: task query
      ]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      const result = await seqService.retryCreate('create-1', 'user-1');

      expect(result.status).toBe('processing');
      expect(seqDb.update).toHaveBeenCalled();
    });

    it('非 failed 状态的 Create 不能重试', async () => {
      const record = buildCreateRecord({ status: 'completed' });
      // getCreate first call returns the record, second call (task) returns empty
      const seqDb = createSequentialDbMock([[record], []]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      await expect(seqService.retryCreate('create-1', 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('Create 不存在时重试应抛出 NotFoundException', async () => {
      db._result = [];

      await expect(service.retryCreate('non-existent', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // listCreates (uses sequential mock for multi-query)
  // ============================================================
  describe('listCreates', () => {
    it('应返回项目下的 Create 列表', async () => {
      const record1 = buildCreateRecord({ id: 'create-1' });
      const record2 = buildCreateRecord({ id: 'create-2', prompt: '一只狗' });
      // Queue: count query → [count:2], items query → [record1, record2],
      // task query for create-1 → [], task query for create-2 → []
      const seqDb = createSequentialDbMock([
        [{ count: 2 }],
        [record1, record2],
        [],
        [],
      ]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      const result = await seqService.listCreates('proj-1', 'user-1');

      expect(result.total).toBe(2);
      expect(result.items.length).toBe(2);
    });

    it('无创作记录时返回空列表', async () => {
      const seqDb = createSequentialDbMock([[{ count: 0 }], []]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      const result = await seqService.listCreates('proj-1', 'user-1');

      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('支持按 status 过滤', async () => {
      const record = buildCreateRecord({ status: 'completed' });
      const seqDb = createSequentialDbMock([
        [{ count: 1 }],
        [record],
        [],
      ]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      const result = await seqService.listCreates('proj-1', 'user-1', { status: 'completed' });

      expect(result.total).toBe(1);
    });
  });

  // ============================================================
  // toResponse 字段映射
  // ============================================================
  describe('toResponse 字段映射', () => {
    it('应正确映射所有字段到 CreateResponse', async () => {
      const record = buildCreateRecord({
        id: 'create-99',
        status: 'completed',
        output: { imageUrl: 'https://cdn.vibeai.com/test.png' },
        taskCount: 3,
        modelSlug: 'doubao-seedream-5-0',
      });
      const task = buildTaskRecord({ status: 'completed', progress: 100 });
      const seqDb = createSequentialDbMock([[record], [task]]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      const result = await seqService.getCreate('create-99', 'user-1');

      expect(result.id).toBe('create-99');
      expect(result.status).toBe('completed');
      expect(result.output).toEqual({ imageUrl: 'https://cdn.vibeai.com/test.png' });
      expect(result.taskCount).toBe(3);
      expect(result.modelSlug).toBe('doubao-seedream-5-0');
      expect(result.taskStatus).toBe('completed');
      expect(result.taskProgress).toBe(100);
      expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('sourceCreateId 非空时表示迭代链', async () => {
      const record = buildCreateRecord({ sourceCreateId: 'create-0' });
      const seqDb = createSequentialDbMock([[record], []]);
      const seqService = new CreateService(seqDb as any, storageService as any, projectService as any);

      const result = await seqService.getCreate('create-1', 'user-1');

      expect(result.sourceCreateId).toBe('create-0');
    });
  });
});
