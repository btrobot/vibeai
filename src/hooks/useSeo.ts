import { useEffect } from 'react';

interface SeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
}

interface SeoValue {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
}

const DEFAULT_OG_IMAGE = '/og-default.png';

/**
 * 动态 SEO 注入 hook
 * - 拉取 /api/system-config/public/seo.default 取默认配置
 * - 合并传入的 overrides
 * - 写入 document.title 和 <meta> tags
 * - 卸载时还原（实际不还原，依赖组件重新调用覆盖）
 */
export function useSeo(overrides: SeoConfig = {}) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/system-config/public/seo.default');
        if (!res.ok) {
          applySeo(overrides);
          return;
        }
        const data = await res.json();
        const raw = data.data?.value ?? data.value ?? data.data ?? data;
        if (cancelled) return;
        const seoValue: SeoValue =
          raw && typeof raw === 'object' ? (raw as SeoValue) : {};
        applySeo({ ...seoValue, ...overrides });
      } catch {
        if (!cancelled) applySeo(overrides);
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function applySeo(seo: SeoConfig) {
  const title = seo.title?.trim();
  const description = seo.description?.trim();
  const keywords = seo.keywords?.trim();
  const ogImage = seo.ogImage?.trim() || DEFAULT_OG_IMAGE;

  if (title) document.title = title;
  setMeta('description', description);
  setMeta('keywords', keywords);
  setMeta('og:title', title, 'property');
  setMeta('og:description', description, 'property');
  setMeta('og:image', ogImage, 'property');
  setMeta('og:type', 'website', 'property');
}

function setMeta(name: string, content: string | undefined, attr: 'name' | 'property' = 'name') {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}