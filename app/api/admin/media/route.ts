import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Media, Product, Category, Content } from '@/lib/models';
import { deleteImage, isManagedPublicId, optimizedImageUrl } from '@/lib/cloudinary';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAdmin())) return adminDenied();
  await db();
  const items = await Media.find().sort({ createdAt: -1 }).limit(300).lean();
  return Response.json({
    media: items.map((m: any) => ({ ...m, _id: String(m._id), url: optimizedImageUrl(m.url) })),
  });
}

/** Removes an asset only when no product, category or content record still references it. */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  const { publicId } = await req.json().catch(() => ({}));
  if (!isManagedPublicId(publicId)) {
    return Response.json({ error: 'Only managed Cruvita assets can be removed' }, { status: 400 });
  }
  await db();
  const asset = await Media.findOne({ publicId }).lean() as any;
  if (asset?.resourceType === 'video') {
    return Response.json({ error: 'Video assets must be removed through Cloudinary after checking they are unused' }, { status: 409 });
  }
  const [products, categories, content] = await Promise.all([
    Product.find({ $or: [{ images: { $regex: publicId } }, { publicIds: publicId }] }).countDocuments(),
    Category.find({ publicId }).countDocuments(),
    Content.find({ value: { $regex: publicId } }).countDocuments(),
  ]);
  if (products + categories + content > 0) {
    return Response.json({ error: 'Image is still in use and cannot be removed' }, { status: 409 });
  }
  try {
    await deleteImage(publicId);
    await Media.deleteOne({ publicId });
    return Response.json({ ok: true, publicId });
  } catch (e) {
    console.error('[media] deletion failed:', (e as Error).message);
    return Response.json({ error: 'Cloudinary deletion failed' }, { status: 502 });
  }
}
