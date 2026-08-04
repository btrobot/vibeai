import { useState, useCallback, useRef, useEffect, type ElementType } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/hooks/useAuth';
import { useStorage, type FileItem } from '@/hooks/useStorage';
import { Upload, File, Image, Video, Music, FileText, Trash2, HardDrive, Download, Search, Loader2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'image', label: '图片', icon: Image },
  { value: 'video', label: '视频', icon: Video },
  { value: 'audio', label: '音频', icon: Music },
  { value: 'document', label: '文档', icon: FileText },
  { value: 'temp', label: '临时', icon: File },
  { value: 'asset', label: '资源', icon: File },
  { value: 'private', label: '私有', icon: File },
  { value: 'backup', label: '备份', icon: HardDrive },
] as const;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(mimeType: string): ElementType {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  return FileText;
}

export default function StoragePage() {
  const { fetchUser } = useAuth();
  const { loading, uploadFile, listFiles, deleteFile, getStats } = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<{ totalFiles: number; totalSize: number } | null>(null);

  const loadFiles = useCallback(async () => {
    const result = await listFiles({
      category: selectedCategory || undefined,
      page,
      pageSize: 20,
      search: search || undefined,
    });
    if (result) {
      setFiles(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    }
  }, [listFiles, selectedCategory, page, search]);

  const loadStats = useCallback(async () => {
    const result = await getStats();
    if (result) {
      setStats({ totalFiles: result.totalFiles, totalSize: result.totalSize });
    }
  }, [getStats]);

  useEffect(() => {
    loadFiles();
    loadStats();
  }, [loadFiles, loadStats]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const result = await uploadFile(file, selectedCategory || 'temp');
    setUploading(false);

    if (result) {
      loadFiles();
      loadStats();
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId: string) => {
    const ok = await deleteFile(fileId);
    if (ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setTotal((prev) => prev - 1);
      loadStats();
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadFiles();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">文件管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理你的所有上传文件
            {stats && ` · 共 ${stats.totalFiles} 个文件 · ${formatFileSize(stats.totalSize)}`}
          </p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? '上传中...' : '上传文件'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={selectedCategory === '' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setSelectedCategory(''); setPage(1); }}
              >
                全部
              </Button>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <Button
                    key={cat.value}
                    variant={selectedCategory === cat.value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { setSelectedCategory(cat.value); setPage(1); }}
                    className="gap-1.5"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </Button>
                );
              })}
            </div>
            <form onSubmit={handleSearch} className="ml-auto flex gap-2">
              <Input
                placeholder="搜索文件名..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-48"
              />
              <Button type="submit" size="sm" variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {loading && files.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={HardDrive}
              title="暂无文件"
              description="点击上方「上传文件」开始使用"
              className="py-20"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.mimeType);
              const isImage = file.mimeType.startsWith('image/');
              return (
                <Card
                  key={file.id}
                  className="group relative overflow-hidden transition-all duration-200 hover:border-primary/30"
                >
                  {/* Preview */}
                  <div className="flex aspect-video items-center justify-center bg-muted">
                    {isImage ? (
                      <img
                        src={file.url}
                        alt={file.originalName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FileIcon className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>

                  {/* Info */}
                  <CardContent className="p-3">
                    <p className="truncate text-sm font-medium" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{formatFileSize(file.size)}</span>
                      <span>·</span>
                      <span>{formatDate(file.createdAt)}</span>
                    </div>
                    <div className="mt-2">
                      <Badge variant="default">{file.category}</Badge>
                    </div>
                  </CardContent>

                  {/* Actions */}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(file.url, '_blank')}
                      aria-label="下载文件"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(file.id)}
                      aria-label="删除文件"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span className="px-3 text-sm text-muted-foreground font-mono">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
