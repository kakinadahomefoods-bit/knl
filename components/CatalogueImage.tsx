'use client';

import { useState } from 'react';
import manifest from '@/lib/thumbnail-manifest.json';

const thumbnails = manifest as Record<string, Record<string, string>>;

function sources(url: string) {
  let key = url;
  try { key = decodeURIComponent(url); } catch { /* Keep the original URL. */ }
  const local = thumbnails[key];
  if (local) {
    const variants = Object.entries(local).sort(([a], [b]) => Number(a) - Number(b));
    return { src: local['640'] || url, srcSet: variants.map(([width, src]) => `${encodeURI(src)} ${width}w`).join(', ') };
  }
  if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) {
    const variant = (width: number) => url.replace('/upload/', `/upload/c_limit,w_${width},f_auto,q_auto:good/`);
    return { src: variant(640), srcSet: [400, 640, 960, 1280].map((width) => `${variant(width)} ${width}w`).join(', ') };
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
    sizes={category ? '(max-width: 700px) 90vw, (min-width: 1500px) 480px, 33vw' : '(max-width: 700px) 50vw, (max-width: 1100px) 33vw, (min-width: 1600px) 300px, 25vw'}
    alt={alt}
    width={640}
    height={640}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    onError={() => { if (!failed && image.src !== src) setFailed(true); }}
    style={category ? undefined : { width: '100%', height: '100%', objectFit: 'contain' }}
  />;
}
