import mongoose from 'mongoose';
import fs from 'node:fs';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');

const mappings = [
  ['all-mix-cookies-250g-4-types-of-cookies', '01_All_Mix_Cookies_250g'],
  ['chocolate-chip-cookies-400g-6pcs', '02_Chocolate_Chip_Cookies_400g'],
  ['chocolate-chip-cookies-700g-pack-of-8', '03_Chocolate_Chip_Cookies_700g'],
  ['double-chocolate-chip-cookies-700g-pack-of-8', '04_Double_Chocolate_Chip_Cookies_700g'],
  ['double-chocolate-chip-cookies-400g-pack-of-6', '05_Double_Chocolate_Chip_Cookies_400g'],
  ['chocolate-walnut-brownie-pack-of-6', '06_Chocolate_Walnut_Brownies'],
  ['classic-chocolate-brownie-pack-of-6', '07_Classic_Chocolate_Brownies'],
  ['double-chocolate-brownies-pack-of-6', '08_Double_Chocolate_Brownies'],
  ['all-mix-brownies', '09_All_Mix_Brownies'],
  ['dry-fruits-cookies-250g-pack-of-5', '10_Dry_Fruits_Cookies_250g'],
];

await mongoose.connect(uri);
const products = mongoose.connection.collection('products');
let updated = 0;
for (const [slug, folder] of mappings) {
  const dir = `public/products/${folder}`;
  const files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  const images = files.map(f => `/${dir}/${f}`.replace('public/', '/'));
  // Actually public path should be /products/...
  const publicImages = files.map(f => `/products/${folder}/${f}`);
  const res = await products.updateOne({ slug }, { $set: { images: publicImages, updatedAt: new Date() } });
  console.log(slug, '->', publicImages.length, 'images', 'modified:', res.modifiedCount);
  if (res.modifiedCount) updated++;
}
console.log('Updated', updated, 'of', mappings.length);
await mongoose.disconnect();
