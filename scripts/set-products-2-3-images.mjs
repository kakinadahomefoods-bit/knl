import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const col = mongoose.connection.collection('products');
const updates = [
  ['chocolate-chip-cookies-400g-6pcs', [
    '/products/chocolate-chip-cookies-400g-6pcs-1.png',
    '/products/chocolate-chip-cookies-400g-6pcs-2.png',
  ]],
  ['chocolate-chip-cookies-700g-pack-of-8', [
    '/products/chocolate-chip-cookies-700g-pack-of-8-1.png',
    '/products/chocolate-chip-cookies-700g-pack-of-8-2.png',
  ]],
];
for (const [slug, images] of updates) {
  const r = await col.updateOne({ slug }, { $set: { images, updatedAt: new Date() } });
  console.log(slug, 'modified:', r.modifiedCount);
}
await mongoose.disconnect();
