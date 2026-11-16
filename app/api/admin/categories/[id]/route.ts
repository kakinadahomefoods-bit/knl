import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Category } from '@/lib/models';
import { optimizedImageUrl } from '@/lib/cloudinary';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

type C = { params: Promise<{ id: string }> };
const allowed = ['name', 'slug', 'description', 'image', 'publicId', 'sortOrder', 'published'];

export async function PATCH(req: Request, c: C) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const x = await req.json();
    const changes = Object.fromEntries(Object.entries(x).filter(([k]) => allowed.includes(k)));
    await db();
    const doc = await Category.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).lean() as any;
    if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ category: { ...doc, _id: String(doc._id), image: optimizedImageUrl(doc.image) } });
  } catch {
    return Response.json({ error: 'Update failed' }, { status: 400 });
  }
}

export async function DELETE(_: Request, c: C) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  await db();
  await Category.findByIdAndDelete(id);
  return Response.json({ ok: true });
}
