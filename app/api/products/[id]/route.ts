import { db } from '@/lib/db';
import { Product } from '@/lib/models';
import { isAdmin, adminDenied } from '@/lib/security';
import { optimizedImageUrl } from '@/lib/cloudinary';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

type C = { params: Promise<{ id: string }> };
const allowed = [
  'name', 'slug', 'sku', 'category', 'description', 'price', 'compareAt', 'stock',
  'lowStockAt', 'images', 'publicIds', 'variants', 'tags', 'featured', 'published',
  'weightGrams', 'lengthCm', 'breadthCm', 'heightCm', 'seoTitle', 'seoDescription',
];

const present = (doc: any) => ({
  ...doc,
  _id: String(doc._id),
  images: (doc.images || []).map((u: string) => optimizedImageUrl(u)),
});

export async function GET(_: Request, c: C) {
  try {
    const { id } = await c.params;
    await db();
    const query = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
    const doc = await Product.findOne(query).lean() as any;
    if (!doc || (!doc.published && !(await isAdmin()))) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    return Response.json({ product: present(doc) });
  } catch {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

export async function PATCH(req: Request, c: C) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const data = await req.json();
    const changes: Record<string, unknown> = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowed.includes(k))
    );
    if ('price' in changes) changes.price = Number(changes.price);
    for (const key of ['weightGrams', 'lengthCm', 'breadthCm', 'heightCm']) {
      if (key in changes) {
        const n = Number(changes[key]);
        changes[key] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
    }
    if ('stock' in changes) {
      const n = Number(changes.stock);
      changes.stock = Number.isFinite(n) && n >= 0 ? n : 0;
    }
    await db();
    const product = await Product.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).lean();
    if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });
    return Response.json({ product: present(product) });
  } catch {
    return Response.json({ error: 'Update failed' }, { status: 400 });
  }
}

export async function DELETE(_: Request, c: C) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  await db();
  await Product.findByIdAndUpdate(id, { published: false });
  return Response.json({ ok: true });
}
