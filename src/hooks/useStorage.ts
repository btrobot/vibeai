import { useCallback, useState } from 'react';

interface FileItem {
  id: string;
  userId: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  storageKey: string;
  url: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FileListResponse {
  items: FileItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface StorageStats {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
}

export function useStorage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const stored = localStorage.getItem('auth_tokens');
    if (!stored) return {};
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  }, []);

  const uploadFile = useCallback(
    async (file: File, category: string = 'temp'): Promise<FileItem | null> => {
      setLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);

        const res = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
          },
          body: formData,
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || result.message || '上传失败');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : '上传失败';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getAuthHeaders],
  );

  const listFiles = useCallback(
    async (params?: { category?: string; page?: number; pageSize?: number; search?: string }): Promise<FileListResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams();
        if (params?.category) query.set('category', params.category);
        if (params?.page) query.set('page', String(params.page));
        if (params?.pageSize) query.set('pageSize', String(params.pageSize));
        if (params?.search) query.set('search', params.search);

        const res = await fetch(`/api/storage/files?${query.toString()}`, {
          headers: { ...getAuthHeaders() },
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || '获取文件列表失败');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : '获取文件列表失败';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getAuthHeaders],
  );

  const deleteFile = useCallback(
    async (fileId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/storage/files/${fileId}`, {
          method: 'DELETE',
          headers: { ...getAuthHeaders() },
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || '删除失败');
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : '删除失败';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getAuthHeaders],
  );

  const getStats = useCallback(async (): Promise<StorageStats | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/storage/stats', {
        headers: { ...getAuthHeaders() },
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || '获取统计失败');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取统计失败';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  return {
    loading,
    error,
    uploadFile,
    listFiles,
    deleteFile,
    getStats,
    setError,
  };
}

export type { FileItem, FileListResponse, StorageStats };