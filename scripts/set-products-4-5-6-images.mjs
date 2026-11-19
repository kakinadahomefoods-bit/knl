import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const col = mongoose.connection.collection('products');
const updates = [
  ['double-chocolate-chip-cookies-700g-pack-of-8', [
    '/products/double-chocolate-chip-cookies-700g-pack-of-8-1.png',
    '/products/double-chocolate-chip-cookies-700g-pack-of-8-2.png',
  ]],
  ['double-chocolate-chip-cookies-400g-pack-of-6', [
    '/products/double-chocolate-chip-cookies-400g-pack-of-6-1.png',
    '/products/double-chocolate-chip-cookies-400g-pack-of-6-2.png',
  ]],
  ['chocolate-walnut-brownie-pack-of-6', [
    '/products/chocolate-walnut-brownie-pack-of-6-1.png',
    '/products/chocolate-walnut-brownie-pack-of-6-2.png',
  ]],
];
for (const [slug, images] of updates) {
  const r = await col.updateOne({ slug }, { $set: { images, updatedAt: new Date() } });
  console.log(slug, 'modified:', r.modifiedCount);
}
await mongoose.disconnect();
