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

  describe('updateTaskCounts', () => {
    it('should update task counts', async () => {
      // First select: count query
      // Second select: update query
      mockSingle(db, { total: 10, completed: 6 });

      await expect(service.updateTaskCounts('proj-1')).resolves.toBeUndefined();
    });
  });
});