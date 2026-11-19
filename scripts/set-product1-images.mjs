import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const images = [
  '/products/all-mix-cookies-250g-4-types-of-cookies-1.png',
  '/products/all-mix-cookies-250g-4-types-of-cookies-2.png',
];
const r = await mongoose.connection.collection('products').updateOne(
  { slug: 'all-mix-cookies-250g-4-types-of-cookies' },
  { $set: { images, updatedAt: new Date() } }
);
console.log('modified:', r.modifiedCount);
await mongoose.disconnect();
