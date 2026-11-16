import { v2 as cloudinary } from 'cloudinary';

export const MEDIA_FOLDERS = [
  'cruvita/products',
  'cruvita/banners',
  'cruvita/categories',
  'cruvita/logo',
] as const;

export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export function resolveFolder(value: unknown): MediaFolder {
  const folder = typeof value === 'string' && MEDIA_FOLDERS.includes(value as MediaFolder)
    ? (value as MediaFolder)
    : 'cruvita/products';
  return folder;
}

export function isCloudinaryUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url);
}

/** Insert Cloudinary auto-format/auto-quality into an existing delivery URL. */
export function optimizedImageUrl(url: unknown, width?: number): string {
  if (typeof url !== 'string' || !url) return '';
  if (!isCloudinaryUrl(url)) return url;
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  const transforms = ['f_auto', 'q_auto'];
  if (width && Number.isFinite(width)) transforms.push('w_' + Math.round(width));
  return parts[0] + '/upload/' + transforms.join(',') + '/' + parts[1];
}

export async function uploadImage(bytes: Buffer, folder: MediaFolder, publicId?: string) {
  const client = configureCloudinary();
  return new Promise<{
    url: string;
    publicId: string;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    folder: MediaFolder;
  }>((resolve, reject) => {
    const options: Record<string, unknown> = {
      folder,
      resource_type: 'image',
      overwrite: true,
    };
    if (publicId) options.public_id = publicId;
    const stream = client.uploader.upload_stream(options, (err, result) => {
      if (err || !result) return reject(err || new Error('Upload returned no result'));
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        folder,
      });
    });
    stream.end(bytes);
  });
}

/** Only assets inside approved Cruvita folders may be deleted. */
export function isManagedPublicId(publicId: unknown): publicId is string {
  return typeof publicId === 'string' && MEDIA_FOLDERS.some((f) => publicId.startsWith(f + '/'));
}

export async function deleteImage(publicId: string) {
  if (!isManagedPublicId(publicId)) throw new Error('Asset is not managed by this application');
  const client = configureCloudinary();
  return client.uploader.destroy(publicId, { invalidate: true });
}
