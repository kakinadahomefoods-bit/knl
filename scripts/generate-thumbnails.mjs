import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

const source = path.join(process.cwd(), 'public', 'products');
const destination = path.join(process.cwd(), 'public', 'thumbnails');
await mkdir(destination, { recursive: true });
const manifest = {};
let originalBytes = 0;
let thumbnailBytes = 0;
for (const name of await readdir(source)) {
  if (!/\.(png|jpe?g|webp)$/i.test(name)) continue;
  const bytes = await readFile(path.join(source, name));
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const variants = {};
  const metadata = await sharp(bytes).rotate().toBuffer({ resolveWithObject: true });
  const sourceWidth = metadata.info.width;
  for (const width of [400, 640, 960, 1280]) {
    if (width >= sourceWidth) continue;
    // Include encoding settings in the filename: the old URLs are immutable.
    const filename = `${hash}-q88-${width}.webp`;
    const output = await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    await writeFile(path.join(destination, filename), output);
    variants[width] = `/thumbnails/${filename}`;
    thumbnailBytes += output.length;
  }
  variants[sourceWidth] = `/products/${name}`;
  originalBytes += bytes.length;
  manifest[`/products/${name}`] = variants;
}
await writeFile(path.join(process.cwd(), 'lib', 'thumbnail-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ images: Object.keys(manifest).length, originalBytes, thumbnailBytes }));
