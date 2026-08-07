import { useCallback, useRef, useState } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL = 30_000; // 30s

/**
 * Lightweight API cache hook — avoids redundant identical fetches
 * within a short TTL window. No external dependency.
 */
export function useApiCache() {
  const cache = useRef<Map<string, CacheEntry<unknown>>>(new Map());

  const fetchWithCache = useCallback(
    async <T>(url: string, options?: RequestInit, ttl = DEFAULT_TTL): Promise<T> => {
      const key = url;
      const cached = cache.current.get(key) as CacheEntry<T> | undefined;

      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }

      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`API ${res.status}: ${res.statusText}`);
      }
      const data: T = await res.json();
      cache.current.set(key, { data, timestamp: Date.now() });
      return data;
    },
    [],
  );

  const invalidate = useCallback((urlPattern?: string) => {
    if (!urlPattern) {
      cache.current.clear();
      return;
    }
    for (const key of cache.current.keys()) {
      if (key.includes(urlPattern)) {
        cache.current.delete(key);
      }
    }
  }, []);

  return { fetchWithCache, invalidate };
}
