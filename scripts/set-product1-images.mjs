import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const images = [
  '/products/Assorted Gourmet Cookie Platter-2.png',
  '/products/Assorted Gourmet Cookie Cluster-1.png',
];
const r = await mongoose.connection.collection('products').updateOne(
  { slug: 'all-mix-cookies-250g-4-types-of-cookies' },
  { $set: { images, updatedAt: new Date() } }
);
console.log('modified:', r.modifiedCount);
await mongoose.disconnect();
