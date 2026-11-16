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
    await db();
    const value = {
      title: clean(x.title, 200),
      subtitle: clean(x.subtitle, 200),
      image: typeof x.image === 'string' ? x.image : '',
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
