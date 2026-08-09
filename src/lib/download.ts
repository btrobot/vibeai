/**
 * File download utilities
 */

export interface DownloadOptions {
  filename: string;
  blob: Blob;
  fallbackUrl?: string; // 下载失败时的备用 URL
}

/**
 * Download a file from Blob
 */
export async function downloadFile(options: DownloadOptions): Promise<void> {
  const { filename, blob, fallbackUrl } = options;
  
  try {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    // Fallback: open in new tab
    if (fallbackUrl) {
      window.open(fallbackUrl, '_blank');
    } else {
      throw error;
    }
  }
}

/**
 * Download a file from URL
 * Automatically handles Blob conversion and download
 */
export async function downloadFromUrl(
  url: string,
  filename: string,
  options?: {
    headers?: Record<string, string>;
    fallbackUrl?: string;
  }
): Promise<void> {
  try {
    const response = await fetch(url, {
      headers: options?.headers,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    return downloadFile({
      filename,
      blob,
      fallbackUrl: options?.fallbackUrl || url,
    });
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

/**
 * Generate timestamp for filename
 */
export function getDownloadTimestamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
