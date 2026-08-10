import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AdminAuditService } from '../modules/admin/services/admin-audit.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    interceptor = new AuditInterceptor(auditService as any);
  });

  function createMockContext(method: string, path: string, user?: { id: string }) {
    const request: any = {
      method,
      path,
      url: path,
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      user,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  function createMockHandler(shouldError = false): CallHandler {
    return {
      handle: () => (shouldError ? throwError(() => new Error('Handler failed')) : of({ ok: true })),
    } as unknown as CallHandler;
  }

  it('should not log audit entry for GET requests', async () => {
    const ctx = createMockContext('GET', '/api/admin/users', { id: 'admin-1' });
    const next = createMockHandler();

    await interceptor.intercept(ctx, next).toPromise();

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('should create audit log entry on admin mutation (POST)', async () => {
    const ctx = createMockContext('POST', '/api/admin/users', { id: 'admin-1' });
    const next = createMockHandler();

    await interceptor.intercept(ctx, next).toPromise();

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin-1',
        action: 'create',
        entityType: 'user',
        status: 'success',
      }),
    );
  });

  it('should log with status failed when handler throws', async () => {
    const ctx = createMockContext('DELETE', '/api/admin/gallery/abc-123', { id: 'admin-1' });
    const next = createMockHandler(true);

    // The interceptor should re-throw the error but still log
    await expect(interceptor.intercept(ctx, next).toPromise()).rejects.toThrow('Handler failed');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        action: 'delete',
        entityType: 'gallery',
      }),
    );
  });

  it('should skip non-admin paths', async () => {
    const ctx = createMockContext('POST', '/api/auth/login', { id: 'admin-1' });
    const next = createMockHandler();

    await interceptor.intercept(ctx, next).toPromise();

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('should skip when no authenticated user', async () => {
    const ctx = createMockContext('POST', '/api/admin/users');
    const next = createMockHandler();

    await interceptor.intercept(ctx, next).toPromise();

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('should resolve action from path patterns (ban/unban/refund)', async () => {
    const ctx = createMockContext('PATCH', '/api/admin/users/abc-123/ban', { id: 'admin-1' });
    const next = createMockHandler();

    await interceptor.intercept(ctx, next).toPromise();

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ban',
      }),
    );
  });

  it('should intercept announcement mutations', async () => {
    const ctx = createMockContext('POST', '/api/announcements', { id: 'admin-1' });
    const next = createMockHandler();

    await interceptor.intercept(ctx, next).toPromise();

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'announcement',
        action: 'create',
      }),
    );
  });

  it('should intercept system-config mutations', async () => {
    const ctx = createMockContext('DELETE', '/api/system-config/homepage.carousel', { id: 'admin-1' });
    const next = createMockHandler();

    await interceptor.intercept(ctx, next).toPromise();

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'config',
        action: 'delete',
        entityId: 'homepage.carousel',
      }),
    );
  });
});
