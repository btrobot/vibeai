import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getAuthHeaders } from '@/components/admin/types';

// ===== Types =====

export interface UseAdminCrudOptions<T> {
  /** Base API endpoint, e.g. '/api/announcements' */
  endpoint: string;
  /** Page size (default 10) */
  pageSize?: number;
  /** Whether the endpoint supports pagination (default true). Set false for SystemConfig. */
  paginated?: boolean;
  /** Query param name for page size (default 'pageSize'; 'limit' for announcements) */
  pageSizeParam?: string;
  /** Extract items array from response. Default handles {data:[]} and {items:[]}. */
  extractItems?: (res: unknown) => T[];
  /** Extract pagination info from response. Optional. */
  extractPagination?: (res: unknown) => { total: number; totalPages: number };
  /** Extract a single created/updated item from response. Default: (res) => res.data ?? res. */
  extractItem?: (res: unknown) => T | null;
  /** Filter params object. When changed (deep-equal), refetch from page 1. */
  filterParams?: Record<string, string>;
}

export interface UseAdminCrudReturn<T> {
  // State
  items: T[];
  loading: boolean;
  page: number;
  total: number;
  totalPages: number;
  // Navigation
  setPage: (p: number | ((prev: number) => number)) => void;
  // Read
  fetchPage: (p: number) => Promise<void>;
  refetch: () => Promise<void>;
  // Write – standard CRUD (optimistic + rollback)
  create: (body: Record<string, unknown>) => Promise<T | null>;
  update: (id: string, body: Record<string, unknown>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  // Building blocks for custom operations (non-standard endpoints)
  patchItem: (id: string, updater: (item: T) => T, request: () => Promise<boolean>) => Promise<boolean>;
  removeVia: (id: string, request: () => Promise<boolean>) => Promise<boolean>;
  // Direct state setters (escape hatches)
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  setTotal: React.Dispatch<React.SetStateAction<number>>;
}

// ===== Default extractors =====

function defaultExtractItems<T>(res: unknown): T[] {
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  if (Array.isArray(res)) return res as T[];
  return [];
}

function defaultExtractItem<T>(res: unknown): T | null {
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data !== undefined && obj.data !== null) return obj.data as T;
  }
  return (res as T) ?? null;
}

// ===== Hook =====

export function useAdminCrud<T extends { id: string }>(
  options: UseAdminCrudOptions<T>,
): UseAdminCrudReturn<T> {
  const {
    endpoint,
    pageSize = 10,
    paginated = true,
    pageSizeParam = 'pageSize',
    extractItems = defaultExtractItems,
    extractPagination,
    extractItem = defaultExtractItem,
    filterParams = {},
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Keep a ref to items for snapshot/rollback without stale closures
  const itemsRef = useRef<T[]>([]);
  itemsRef.current = items;

  // AbortController for race condition handling
  const abortRef = useRef<AbortController | null>(null);

  // Stable filter key for change detection
  const filterKey = useMemo(() => JSON.stringify(filterParams), [filterParams]);
  const filterKeyRef = useRef(filterKey);

  // Stable refs for extractors (avoid re-creating fetchPage on every render)
  const extractItemsRef = useRef(extractItems);
  const extractPaginationRef = useRef(extractPagination);
  const extractItemRef = useRef(extractItem);
  extractItemsRef.current = extractItems;
  extractPaginationRef.current = extractPagination;
  extractItemRef.current = extractItem;

  // Filter params ref for use inside fetchPage
  const filterParamsRef = useRef(filterParams);
  filterParamsRef.current = filterParams;

  // ===== Read: fetchPage with AbortController =====

  const fetchPage = useCallback(
    async (p: number) => {
      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (paginated) {
          params.set('page', String(p));
          params.set(pageSizeParam, String(pageSize));
        }
        Object.entries(filterParamsRef.current).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });

        const sep = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${endpoint}${sep}${params}`, {
          headers: { ...getAuthHeaders() },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        // Discard response if a newer request has started
        if (controller.signal.aborted) return;

        const extracted = extractItemsRef.current(json);
        setItems(extracted);

        if (extractPaginationRef.current) {
          const pg = extractPaginationRef.current(json);
          setTotal(pg.total);
          setTotalPages(pg.totalPages);
        } else if (paginated) {
          // Compute from total field if present, otherwise from items length
          const maybeTotal =
            json && typeof json === 'object' && 'total' in json
              ? Number((json as Record<string, unknown>).total ?? 0)
              : extracted.length;
          setTotal(maybeTotal);
          setTotalPages(Math.max(1, Math.ceil(maybeTotal / pageSize)));
        } else {
          setTotal(extracted.length);
          setTotalPages(1);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // Swallow other errors (consistent with existing pattern)
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [endpoint, pageSize, pageSizeParam, paginated, filterKey],
  );

  // ===== Effect: fetch on page or filter change =====

  useEffect(() => {
    const filterChanged = filterKeyRef.current !== filterKey;
    filterKeyRef.current = filterKey;

    if (filterChanged && page !== 1) {
      // Reset to page 1; the page change will trigger another effect run
      setPage(1);
      return;
    }
    fetchPage(page);
  }, [page, filterKey, fetchPage]);

  // Cleanup: abort on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const refetch = useCallback(async () => {
    await fetchPage(page);
  }, [fetchPage, page]);

  // ===== Write: create (POST -> insert at head) =====

  const create = useCallback(
    async (body: Record<string, unknown>): Promise<T | null> => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        if (!res.ok) return null;
        const json = await res.json();
        const created = extractItemRef.current(json);
        if (created) {
          setItems((prev) => [created, ...prev]);
          setTotal((prev) => prev + 1);
        }
        return created;
      } catch {
        return null;
      }
    },
    [endpoint],
  );

  // ===== Write: update (PATCH -> optimistic replace + rollback) =====

  const update = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<boolean> => {
      const snapshot = itemsRef.current.find((i) => i.id === id);
      if (!snapshot) return false;

      // Optimistic update: merge body into existing item
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...body } : i)));

      try {
        const res = await fetch(`${endpoint}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setItems((prev) => prev.map((i) => (i.id === id ? snapshot : i)));
          return false;
        }
        // Merge server response if available
        const json = await res.json();
        const updated = extractItemRef.current(json);
        if (updated) {
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
        }
        return true;
      } catch {
        setItems((prev) => prev.map((i) => (i.id === id ? snapshot : i)));
        return false;
      }
    },
    [endpoint],
  );

  // ===== Write: remove (DELETE -> optimistic remove + rollback at original position) =====

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const snapshot = itemsRef.current.slice();
      const exists = itemsRef.current.some((i) => i.id === id);
      if (!exists) return false;

      // Optimistic remove
      setItems((prev) => prev.filter((i) => i.id !== id));

      try {
        const res = await fetch(`${endpoint}/${id}`, {
          method: 'DELETE',
          headers: { ...getAuthHeaders() },
        });
        if (!res.ok) {
          setItems(snapshot); // rollback at original position
          return false;
        }
        setTotal((prev) => Math.max(0, prev - 1));
        return true;
      } catch {
        setItems(snapshot); // rollback
        return false;
      }
    },
    [endpoint],
  );

  // ===== Building block: patchItem (custom optimistic update) =====

  const patchItem = useCallback(
    async (
      id: string,
      updater: (item: T) => T,
      request: () => Promise<boolean>,
    ): Promise<boolean> => {
      const snapshot = itemsRef.current.find((i) => i.id === id);
      if (!snapshot) return false;

      setItems((prev) => prev.map((i) => (i.id === id ? updater(i) : i)));

      try {
        const ok = await request();
        if (!ok) {
          setItems((prev) => prev.map((i) => (i.id === id ? snapshot : i)));
        }
        return ok;
      } catch {
        setItems((prev) => prev.map((i) => (i.id === id ? snapshot : i)));
        return false;
      }
    },
    [],
  );

  // ===== Building block: removeVia (custom remove) =====

  const removeVia = useCallback(
    async (id: string, request: () => Promise<boolean>): Promise<boolean> => {
      const snapshot = itemsRef.current.slice();
      const exists = itemsRef.current.some((i) => i.id === id);
      if (!exists) return false;

      setItems((prev) => prev.filter((i) => i.id !== id));

      try {
        const ok = await request();
        if (!ok) {
          setItems(snapshot);
          return false;
        }
        setTotal((prev) => Math.max(0, prev - 1));
        return true;
      } catch {
        setItems(snapshot);
        return false;
      }
    },
    [],
  );

  return {
    items,
    loading,
    page,
    total,
    totalPages,
    setPage,
    fetchPage,
    refetch,
    create,
    update,
    remove,
    patchItem,
    removeVia,
    setItems,
    setTotal,
  };
}
