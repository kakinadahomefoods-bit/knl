'use client';

import { useState } from 'react';
import manifest from '@/lib/thumbnail-manifest.json';

const thumbnails = manifest as Record<string, Record<string, string>>;

function sources(url: string) {
  let key = url;
  try { key = decodeURIComponent(url); } catch { /* Keep the original URL. */ }
  const local = thumbnails[key];
  if (local) return { src: local['640'], srcSet: `${local['320']} 320w, ${local['640']} 640w` };
  if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) {
    const variant = (width: number) => url.replace('/upload/', `/upload/c_limit,w_${width},f_auto,q_auto/`);
    return { src: variant(640), srcSet: `${variant(320)} 320w, ${variant(640)} 640w` };
  }
  return { src: url, srcSet: undefined };
}

export default function CatalogueImage({ src, alt, eager = false, category = false }: {
  src: string; alt: string; eager?: boolean; category?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const image = failed ? { src, srcSet: undefined } : sources(src);
  return <img
    src={image.src}
    srcSet={image.srcSet}
    sizes={category ? '(max-width: 700px) 90vw, 33vw' : '(max-width: 700px) 50vw, (max-width: 1024px) 33vw, 25vw'}
    alt={alt}
    width={640}
    height={640}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    onError={() => { if (!failed && image.src !== src) setFailed(true); }}
    style={category ? undefined : { width: '100%', height: '100%', objectFit: 'contain' }}
  />;
}
