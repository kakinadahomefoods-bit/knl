import { isAdmin, adminDenied, clean } from '@/lib/security';
import { db } from '@/lib/db';
import { Media } from '@/lib/models';
import { uploadImage, resolveFolder, optimizedImageUrl } from '@/lib/cloudinary';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  try {
    const data = await req.formData();
    const file = data.get('file');
    if (!(file instanceof File) || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'Image under 5MB required' }, { status: 400 });
    }
    const folder = resolveFolder(data.get('folder'));
    const publicId = clean(data.get('publicId'), 200) || undefined;
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadImage(bytes, folder, publicId);
    await db();
    await Media.findOneAndUpdate(
      { publicId: result.publicId },
      {
        $set: {
          url: result.url,
          folder: result.folder,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          uploadedBy: 'admin',
        },
      },
      { upsert: true }
    );
    return Response.json({ ...result, url: optimizedImageUrl(result.url), optimized: true });
  } catch (e) {
    console.error('[upload] failed:', (e as Error).message);
    return Response.json({ error: 'Upload failed; check Cloudinary credentials' }, { status: 503 });
  }
}
