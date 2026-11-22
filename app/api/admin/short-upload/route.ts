import { v2 as cloudinary } from 'cloudinary';
import { isAdmin, adminDenied } from '@/lib/security';

export const runtime = 'nodejs';

// Sign only a fixed video folder. The file goes directly to Cloudinary so it
// does not hit Vercel's serverless request-body limit.
export async function POST() {
  if (!(await isAdmin())) return adminDenied();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return Response.json({ error: 'Video storage is not configured' }, { status: 503 });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'cruvita/shorts';
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);
  return Response.json({ cloudName, apiKey, timestamp, folder, signature }, { headers: { 'Cache-Control': 'no-store' } });
}
