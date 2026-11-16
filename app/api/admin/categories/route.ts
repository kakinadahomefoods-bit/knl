import { isAdmin, adminDenied, clean } from '@/lib/security';
import { db } from '@/lib/db';
import { Category } from '@/lib/models';
import { slugify } from '@/lib/validation';
import { optimizedImageUrl } from '@/lib/cloudinary';

export const runtime = 'nodejs';

const present = (c: any) => ({ ...c, _id: String(c._id), image: optimizedImageUrl(c.image) });

export async function GET() {
  if (!(await isAdmin())) return adminDenied();
  await db();
  return Response.json({ categories: (await Category.find().sort({ sortOrder: 1, name: 1 }).lean()).map(present) });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  try {
    const x = await req.json().catch(() => ({}));
    const name = clean(x.name, 120);
    if (!name) return Response.json({ error: 'Name required' }, { status: 400 });
    await db();
    const doc = await Category.create({
      name,
      slug: clean(x.slug, 140) || slugify(name),
      description: clean(x.description, 2000),
      image: typeof x.image === 'string' ? x.image : '',
      publicId: clean(x.publicId, 200),
      sortOrder: Number(x.sortOrder) || 0,
      published: x.published !== false,
    });
    return Response.json({ category: present(doc.toObject()) }, { status: 201 });
  } catch (e: any) {
    return Response.json({ error: e?.code === 11000 ? 'Duplicate slug' : 'Invalid category' }, { status: 400 });
  }
}
