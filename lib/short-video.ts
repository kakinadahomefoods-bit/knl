export function youtubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/')[1] || '';
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      const parts = url.pathname.split('/');
      id = parts[1] === 'shorts' || parts[1] === 'embed' ? parts[2] : url.pathname === '/watch' ? url.searchParams.get('v') || '' : '';
    }
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function validShortUrl(value: string): boolean {
  if (youtubeVideoId(value)) return true;
  try {
    const url = new URL(value, 'https://example.com');
    return (value.startsWith('/') && !value.startsWith('//')) || (url.protocol === 'https:' && !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname.toLowerCase()));
  } catch { return false; }
}
