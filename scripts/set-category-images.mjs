import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const col = mongoose.connection.collection('categories');
const updates = [
  ['cookies', '/products/category-cookies.png'],
  ['brownies', '/products/category-brownies.png'],
  ['gift-boxes', '/products/category-gift-boxes.png'],
];
for (const [slug, image] of updates) {
  const r = await col.updateOne({ slug }, { $set: { image, updatedAt: new Date() } });
  console.log(slug, 'modified:', r.modifiedCount);
}
await mongoose.disconnect();
