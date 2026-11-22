'use client';

import { useState } from 'react';
import { youtubeVideoId } from '@/lib/short-video';

export default function ShortVideo({ url, title }: { url: string; title: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const id = youtubeVideoId(url);
  const poster = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    : url.includes('/video/upload/') ? url.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[^./?]+(?:\?.*)?$/, '.jpg') : undefined;
  return <article className="short-card">
    {loading && !error && <span className="short-status" role="status">Loading video…</span>}
    {error && <span className="short-status" role="alert">Video unavailable</span>}
    {id ? <iframe title={title} src={`https://www.youtube-nocookie.com/embed/${id}`} loading="lazy"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen
      onLoad={() => setLoading(false)} />
      : <video src={url} aria-label={title} poster={poster} controls playsInline muted loop preload="metadata"
        onLoadedData={() => setLoading(false)} onError={() => { setLoading(false); setError(true); }} />}
  </article>;
}
