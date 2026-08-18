/**
 * 给本服务的 serve URL 追加 ?w= 变体参数（缩略图/网格用窄图，
 * 避免浏览器下载+解码全尺寸大图造成卡顿）。
 *
 * 仅对 /api/storage/serve/ 开头的相对路径生效；
 * 外部 URL / data URL 原样返回（不是我们的图，不该改）。
 */
export function imageVariant(url: string | undefined, width: number): string {
  if (!url) return '';
  if (!url.includes('/api/storage/serve/')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}w=${width}`;
}
