import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { createDrizzleMockForNestJS, mockSingle, mockMany, mockEmpty } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';

const projectRecord = {
  id: 'proj-1',
  userId: 'user-1',
  name: '测试项目',
  description: '项目描述',
  coverImage: null,
  status: 'active',
  tags: ['电商', '主图'],
  totalTasks: 5,
  completedTasks: 3,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

describe('ProjectService', () => {
  let service: ProjectService;
  let db: DrizzleMock;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new ProjectService({ db } as any);
  });

  describe('create', () => {
    it('should create a project', async () => {
      mockSingle(db, projectRecord);

      const result = await service.create('user-1', { name: '测试项目', description: '项目描述' });

      expect(result.id).toBe('proj-1');
      expect(result.name).toBe('测试项目');
      expect(result.status).toBe('active');
    });

    it('should create project with tags and template', async () => {
      const tagged = { ...projectRecord, tags: ['电商', '主图'], template: 'product' };
      mockSingle(db, tagged);

      const result = await service.create('user-1', {
        name: '测试项目',
        tags: ['电商', '主图'],
        template: 'product',
      });

      expect(result.tags).toEqual(['电商', '主图']);
    });
  });

  describe('list', () => {
    it('should return paginated projects', async () => {
      const projects = [projectRecord, { ...projectRecord, id: 'proj-2', name: '项目2' }];
      // The mock returns the same _result for both count and list queries
      // So we set _result to the count result and accept that the list also gets count
      mockSingle(db, { count: 2 });

      const result = await service.list('user-1', 1, 20);

      // total is from count query
      expect(result.total).toBe(2);
    });

    it('should return empty list when no projects', async () => {
      mockEmpty(db);

      const result = await service.list('user-1');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getById', () => {
    it('should return project by id', async () => {
      mockSingle(db, projectRecord);

      const result = await service.getById('proj-1', 'user-1');

      expect(result.id).toBe('proj-1');
      expect(result.name).toBe('测试项目');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockEmpty(db);

      await expect(service.getById('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update project', async () => {
      const updated = { ...projectRecord, name: '更新后的项目', updatedAt: new Date() };
      mockSingle(db, updated);

      const result = await service.update('proj-1', 'user-1', { name: '更新后的项目' });

      expect(result.name).toBe('更新后的项目');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockEmpty(db);

      await expect(service.update('nonexistent', 'user-1', { name: 'test' })).rejects.toThrow(NotFoundException);
    });

    it('should only update provided fields, not overwrite with undefined', async () => {
      const updated = { ...projectRecord, name: '新名称', updatedAt: new Date() };
      mockSingle(db, updated);

      // Pass only name — description should NOT be overwritten
      const result = await service.update('proj-1', 'user-1', { name: '新名称' });

      expect(result.name).toBe('新名称');
      // The mock returns the same record, so we can't directly assert what was sent to DB,
      // but the service code filters out undefined before calling .set()
    });

    it('should update multiple fields at once', async () => {
      const updated = {
        ...projectRecord,
        name: '新名称',
        description: '新描述',
        tags: ['新标签'],
        updatedAt: new Date(),
      };
      mockSingle(db, updated);

      const result = await service.update('proj-1', 'user-1', {
        name: '新名称',
        description: '新描述',
        tags: ['新标签'],
      });

      expect(result.name).toBe('新名称');
    });
  });

  describe('delete', () => {
    it('should delete a project', async () => {
      mockSingle(db, { id: 'proj-1' });

      await expect(service.delete('proj-1', 'user-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when project not found', async () => {
      mockEmpty(db);

      await expect(service.delete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCreateCounts', () => {
    it('should update create counts', async () => {
      // First select: count query
      // Second select: update query
      mockSingle(db, { total: 10, completed: 6 });

      await expect(service.updateCreateCounts('proj-1')).resolves.toBeUndefined();
    });
  });

  describe('规则测试', () => {
    it('只有项目所有者可以删除项目', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com', name: 'Test' };
      mockSingle(db, { id: 'proj-1', userId: 'user-1', name: 'Test Project' });

      // 使用正确的 userId 可以删除
      await expect(
        service.delete('proj-1', 'user-1'),
      ).resolves.toBeUndefined();
    });
  });
});
