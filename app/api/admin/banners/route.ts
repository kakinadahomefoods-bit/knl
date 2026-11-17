import { isAdmin, adminDenied, clean } from '@/lib/security';
import { db } from '@/lib/db';
import { Content } from '@/lib/models';
import { optimizedImageUrl } from '@/lib/cloudinary';

export const runtime = 'nodejs';

const KEY_PREFIX = 'banner:';

export async function GET() {
  if (!(await isAdmin())) return adminDenied();
  await db();
  const docs = await Content.find({ key: { $regex: '^' + KEY_PREFIX } }).sort({ key: 1 }).lean();
  return Response.json({
    banners: docs.map((d: any) => ({
      key: d.key,
      ...(d.value || {}),
      image: optimizedImageUrl((d.value as any)?.image),
    })),
  });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  try {
    const x = await req.json().catch(() => {});
    const slug = clean(x.slug, 80).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (!slug) return Response.json({ error: 'Banner slug required' }, { status: 400 });
    const validUrl = (v: unknown) => !v || (typeof v === 'string' && /^(\/(?!\/)|https:\/\/)/i.test(v));
    if (![x.image, x.mobileImage, x.video, x.mobileVideo, x.poster, x.link].every(validUrl)) {
      return Response.json({ error: 'Media and links must be HTTPS or local paths' }, { status: 400 });
    }
    if (x.type === 'video' && (!x.video || !x.poster)) {
      return Response.json({ error: 'Video slides require a video URL and poster image' }, { status: 400 });
    }
    await db();
    const value = {
      title: clean(x.title, 200),
      subtitle: clean(x.subtitle, 200),
      image: typeof x.image === 'string' ? x.image : '',
      type: x.type === 'video' ? 'video' : 'image',
      mobileImage: clean(x.mobileImage, 2000),
      video: clean(x.video, 2000),
      mobileVideo: clean(x.mobileVideo, 2000),
      poster: clean(x.poster, 2000),
      description: clean(x.description, 500),
      ctaText: clean(x.ctaText, 80),
      duration: Math.max(3000, Math.min(30000, Number(x.duration) || 5000)),
      loop: !!x.loop,
      publicId: clean(x.publicId, 200),
      link: clean(x.link, 300),
      enabled: x.enabled !== false,
      sortOrder: Number(x.sortOrder) || 0,
    };
    const doc = await Content.findOneAndUpdate(
      { key: KEY_PREFIX + slug },
      { $set: { value } },
      { upsert: true, new: true }
    ).lean() as any;
    return Response.json({ banner: { key: doc?.key, ...value, image: optimizedImageUrl(value.image) } });
  } catch {
    return Response.json({ error: 'Unable to save banner' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  const { key } = await req.json().catch(() => ({}));
  if (typeof key !== 'string' || !key.startsWith(KEY_PREFIX)) {
    return Response.json({ error: 'Invalid banner key' }, { status: 400 });
  }
  await db();
  await Content.deleteOne({ key });
  return Response.json({ ok: true });
}
