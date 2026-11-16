import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');

const slugs = [
  'all-mix-cookies-250g-4-types-of-cookies',
  'chocolate-chip-cookies-400g-6pcs',
  'chocolate-chip-cookies-700g-pack-of-8',
  'double-chocolate-chip-cookies-700g-pack-of-8',
  'double-chocolate-chip-cookies-400g-pack-of-6',
  'chocolate-walnut-brownie-pack-of-6',
  'classic-chocolate-brownie-pack-of-6',
  'double-chocolate-brownies-pack-of-6',
  'all-mix-brownies',
  'dry-fruits-cookies-250g-pack-of-5',
  'oreo-cookies-400g-pack-of-6',
  'oreo-cookies-700g-pack-of-8',
  'nutella-brownies-pack-of-6',
  'red-velvet-cookies-400g-pack-of-6',
  'red-velvet-cookies-700g-pack-of-8',
  'mini-double-chocolate-chip-cookies-250g',
  'mini-red-velvet-cookies-250g',
  'mini-chocolate-chip-cookies',
  'choco-chip-butter-cake-300g',
  'almond-choco-cookies',
];

const excluded = ['e08b1fe0-8df5-419d-9407-31629e7587bc', 'ChatGPTImageNov2202511_04_39PM'];

await mongoose.connect(uri);
const col = mongoose.connection.collection('products');

for (const slug of slugs) {
  try {
    const r = await fetch('https://www.crusantcookies.com/products/' + slug);
    const html = await r.text();
    const raw = html.match(/https:\/\/cdn2\.clevup\.in\/[^"'\s)]+/g) || [];
    const decoded = raw.map(u => decodeURIComponent(u.replace(/&amp;/g, '&').replace(/\\+$/, '')));
    // dedupe by pathname, exclude logo/favicon
    const seen = new Set();
    const imgs = [];
    for (const u of decoded) {
      if (excluded.some(x => u.includes(x))) continue;
      const path = new URL(u).pathname;
      if (seen.has(path)) continue;
      seen.add(path);
      // prefer width=600 if available
      imgs.push(u.replace('width=200', 'width=600').replace('height=200', 'height=600'));
    }
    if (!imgs.length) {
      console.log(slug, '-> no images found');
      continue;
    }
    await col.updateOne({ slug }, { $set: { images: imgs } });
    console.log(slug, '->', imgs.length, 'images');
  } catch (e) {
    console.log(slug, '-> error', e.message);
  }
}
await mongoose.disconnect();
console.log('Done');
