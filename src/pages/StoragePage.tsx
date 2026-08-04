import { useState, useCallback, useRef, useEffect, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useStorage, type FileItem, type FileListResponse } from '@/hooks/useStorage';
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
  const { user, fetchUser, logout } = useAuth();
  const { loading, uploadFile, listFiles, deleteFile, getStats } = useStorage();
  const navigate = useNavigate();
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
    if (user) {
      loadFiles();
      loadStats();
    }
  }, [user, loadFiles, loadStats]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!user) {
    navigate('/login');
    return null;
  }

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
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">文件管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理你的所有上传文件
            {stats && ` · 共 ${stats.totalFiles} 个文件 · ${formatFileSize(stats.totalSize)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            登出
          </Button>
        </div>
      </div>

      {/* Upload Area */}
      <Card className="mb-6 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
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
            <span className="text-sm text-muted-foreground">
              支持图片、视频、音频、文档等格式
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
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
          <CardContent className="flex flex-col items-center justify-center py-20">
            <HardDrive className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">暂无文件</p>
            <p className="mt-1 text-sm text-muted-foreground">点击上方「上传文件」开始使用</p>
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
                  className="group relative overflow-hidden border-border/50 transition-all duration-200 hover:border-primary/30"
                >
                  {/* Preview */}
                  <div className="flex aspect-video items-center justify-center bg-muted/30">
                    {isImage ? (
                      <img
                        src={file.url}
                        alt={file.originalName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FileIcon className="h-10 w-10 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Info */}
                  <CardContent className="p-3">
                    <p className="truncate text-sm font-medium" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size)}</span>
                      <span>·</span>
                      <span>{formatDate(file.createdAt)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary/80">
                        {file.category}
                      </span>
                    </div>
                  </CardContent>

                  {/* Actions */}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(file.id)}
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
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
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