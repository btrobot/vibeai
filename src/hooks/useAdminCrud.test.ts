import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminCrud } from './useAdminCrud';

interface TestItem {
  id: string;
  name: string;
  status: string;
}

const mockItems: TestItem[] = [
  { id: '1', name: 'Item 1', status: 'active' },
  { id: '2', name: 'Item 2', status: 'inactive' },
  { id: '3', name: 'Item 3', status: 'active' },
];

function makeResponse(items: TestItem[], total?: number) {
  return { items, total: total ?? items.length };
}

describe('useAdminCrud', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof global.fetch;
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'test-token' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== Read: initial fetch =====

  it('应该在挂载时加载第一页数据', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0].name).toBe('Item 1');
    expect(result.current.total).toBe(3);
  });

  it('应该支持 { success, data } 格式的响应', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockItems,
        pagination: { total: 3, totalPages: 1 },
      }),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({
        endpoint: '/api/test',
        pageSizeParam: 'limit',
        extractPagination: (res) => {
          const r = res as Record<string, unknown>;
          const pg = r.pagination as Record<string, number>;
          return { total: pg.total, totalPages: pg.totalPages };
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });
    expect(result.current.total).toBe(3);
    expect(result.current.totalPages).toBe(1);

    // Verify pageSizeParam was 'limit'
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('limit=10');
  });

  // ===== Read: pagination =====

  it('应该支持翻页', async () => {
    let currentPage = 1;
    mockFetch.mockImplementation(async (url: string) => {
      currentPage = Number(new URL(url, 'http://localhost').searchParams.get('page'));
      const items = currentPage === 1 ? mockItems : [{ id: '4', name: 'Item 4', status: 'active' }];
      return { ok: true, json: async () => makeResponse(items, 4) };
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(result.current.page).toBe(2);
      expect(result.current.items[0].id).toBe('4');
    });
  });

  // ===== Read: race condition handling (AbortController) =====

  it('应该取消旧请求当新请求开始时（竞态治理）', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const firstPromise = new Promise((r) => {
      resolveFirst = r;
    });

    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) {
        // First (slow) request - wait to be resolved later
        await firstPromise;
        return { ok: true, json: async () => makeResponse([{ id: 'old', name: 'Old', status: 'x' }]) };
      }
      // Second (fast) request
      return { ok: true, json: async () => makeResponse([{ id: 'new', name: 'New', status: 'x' }]) };
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    // Wait for first fetch to be in-flight
    await vi.waitFor(() => expect(callCount).toBe(1));

    // Start second fetch (page 2) while first is still pending
    await act(async () => {
      await result.current.fetchPage(2);
    });

    // The fast request's data should be shown
    await waitFor(() => {
      expect(result.current.items[0]?.id).toBe('new');
    });

    // Now resolve the slow first request
    resolveFirst({ ok: true, json: async () => makeResponse([{ id: 'old', name: 'Old', status: 'x' }]) });

    // Wait a bit to ensure old response is discarded
    await new Promise((r) => setTimeout(r, 50));

    // Old data should NOT have overwritten new data
    expect(result.current.items[0]?.id).toBe('new');
  });

  it('应该通过AbortController传递signal给fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    renderHook(() => useAdminCrud<TestItem>({ endpoint: '/api/test' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const callOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(callOptions.signal).toBeInstanceOf(AbortSignal);
  });

  // ===== Write: create (optimistic insert at head) =====

  it('create应该在成功后将返回的数据插入到列表头部', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    // Mock create response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 'new-1', name: 'New Item', status: 'active' } }),
    });

    let created: TestItem | null = null;
    await act(async () => {
      created = await result.current.create({ name: 'New Item' });
    });

    expect(created).not.toBeNull();
    expect(created!.id).toBe('new-1');
    expect(result.current.items[0].id).toBe('new-1');
    expect(result.current.items).toHaveLength(4);
    expect(result.current.total).toBe(4);
  });

  it('create失败时不应该修改列表', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await act(async () => {
      const created = await result.current.create({ name: 'Fail' });
      expect(created).toBeNull();
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.total).toBe(3);
  });

  // ===== Write: update (optimistic + rollback) =====

  it('update应该乐观更新本地数据', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: '1', name: 'Updated', status: 'active' } }),
    });

    await act(async () => {
      const ok = await result.current.update('1', { name: 'Updated' });
      expect(ok).toBe(true);
    });

    expect(result.current.items[0].name).toBe('Updated');
  });

  it('update失败时应该回滚到原始数据', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    const originalName = result.current.items[0].name;

    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await act(async () => {
      const ok = await result.current.update('1', { name: 'Should Rollback' });
      expect(ok).toBe(false);
    });

    // Should be rolled back
    expect(result.current.items[0].name).toBe(originalName);
  });

  it('update网络错误时应该回滚', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    const originalName = result.current.items[0].name;

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      const ok = await result.current.update('1', { name: 'Network Fail' });
      expect(ok).toBe(false);
    });

    expect(result.current.items[0].name).toBe(originalName);
  });

  // ===== Write: remove (optimistic + rollback at position) =====

  it('remove应该乐观删除本地数据', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      const ok = await result.current.remove('2');
      expect(ok).toBe(true);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.find((i) => i.id === '2')).toBeUndefined();
    expect(result.current.total).toBe(2);
  });

  it('remove失败时应该回滚到原始列表（保持原始顺序）', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await act(async () => {
      const ok = await result.current.remove('2');
      expect(ok).toBe(false);
    });

    // Should be rolled back with original order
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[1].id).toBe('2'); // restored at original position
    expect(result.current.items.map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  // ===== Filter change resets to page 1 =====

  it('筛选条件变化时应该重置到第1页并重新请求', async () => {
    let firstCall = true;
    mockFetch.mockImplementation(async (url: string) => {
      const u = new URL(url, 'http://localhost');
      const page = u.searchParams.get('page');
      const status = u.searchParams.get('status');
      if (firstCall && page === '1' && !status) {
        firstCall = false;
        return { ok: true, json: async () => makeResponse(mockItems, 3) };
      }
      if (status === 'active') {
        return {
          ok: true,
          json: async () =>
            makeResponse([{ id: '4', name: 'Filtered', status: 'active' }], 1),
        };
      }
      return { ok: true, json: async () => makeResponse(mockItems, 3) };
    });

    const { result, rerender } = renderHook(
      ({ filterParams }) =>
        useAdminCrud<TestItem>({
          endpoint: '/api/test',
          filterParams,
        }),
      { initialProps: { filterParams: {} } },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    // Go to page 2
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));

    // Change filter -> should reset to page 1 and refetch
    rerender({ filterParams: { status: 'active' } });

    await waitFor(() => {
      expect(result.current.page).toBe(1);
      expect(result.current.items[0]?.id).toBe('4');
    });
  });

  // ===== Building block: patchItem (custom optimistic update) =====

  it('patchItem应该乐观更新并通过自定义请求函数', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    const customRequest = vi.fn().mockResolvedValue(true);

    await act(async () => {
      const ok = await result.current.patchItem(
        '1',
        (item) => ({ ...item, status: 'custom' }),
        customRequest,
      );
      expect(ok).toBe(true);
    });

    expect(result.current.items[0].status).toBe('custom');
    expect(customRequest).toHaveBeenCalledTimes(1);
  });

  it('patchItem失败时应该回滚', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    const originalStatus = result.current.items[0].status;
    const customRequest = vi.fn().mockResolvedValue(false);

    await act(async () => {
      const ok = await result.current.patchItem(
        '1',
        (item) => ({ ...item, status: 'changed' }),
        customRequest,
      );
      expect(ok).toBe(false);
    });

    expect(result.current.items[0].status).toBe(originalStatus);
  });

  it('patchItem网络错误时应该回滚', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    const originalStatus = result.current.items[0].status;
    const customRequest = vi.fn().mockRejectedValue(new Error('fail'));

    await act(async () => {
      const ok = await result.current.patchItem(
        '1',
        (item) => ({ ...item, status: 'changed' }),
        customRequest,
      );
      expect(ok).toBe(false);
    });

    expect(result.current.items[0].status).toBe(originalStatus);
  });

  // ===== Building block: removeVia (custom remove) =====

  it('removeVia应该乐观删除并通过自定义请求函数', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    const customRequest = vi.fn().mockResolvedValue(true);

    await act(async () => {
      const ok = await result.current.removeVia('1', customRequest);
      expect(ok).toBe(true);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.find((i) => i.id === '1')).toBeUndefined();
  });

  it('removeVia失败时应该回滚', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeResponse(mockItems, 3),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    const customRequest = vi.fn().mockResolvedValue(false);

    await act(async () => {
      const ok = await result.current.removeVia('1', customRequest);
      expect(ok).toBe(false);
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items.map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  // ===== Non-paginated mode =====

  it('非分页模式不应该发送分页参数', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockItems }),
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/config', paginated: false }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).not.toContain('page=');
    expect(callUrl).not.toContain('pageSize=');
  });

  // ===== refetch =====

  it('refetch应该重新请求当前页', async () => {
    let fetchCount = 0;
    mockFetch.mockImplementation(async () => {
      fetchCount++;
      return { ok: true, json: async () => makeResponse(mockItems, 3) };
    });

    const { result } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    await waitFor(() => expect(fetchCount).toBe(1));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchCount).toBe(2);
  });

  // ===== Abort on unmount =====

  it('组件卸载时应该取消进行中的请求', async () => {
    let aborted = false;
    mockFetch.mockImplementation(async (_url: string, opts?: RequestInit) => {
      return new Promise((resolve) => {
        const signal = opts?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            aborted = true;
            const err = new DOMException('Aborted', 'AbortError');
            resolve(Promise.reject(err) as unknown as Response);
          });
        }
        // Never resolves naturally; only via abort
        setTimeout(() => {
          resolve({ ok: true, json: async () => makeResponse(mockItems, 3) } as unknown as Response);
        }, 10000);
      });
    });

    const { unmount } = renderHook(() =>
      useAdminCrud<TestItem>({ endpoint: '/api/test' }),
    );

    unmount();

    await new Promise((r) => setTimeout(r, 50));
    expect(aborted).toBe(true);
  });
});
