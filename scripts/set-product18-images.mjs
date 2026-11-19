import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const images = [
  '/products/mini-chocolate-chip-cookies-1.png',
  '/products/mini-chocolate-chip-cookies-2.png',
];
const r = await mongoose.connection.collection('products').updateOne(
  { slug: 'mini-chocolate-chip-cookies' },
  { $set: { images, updatedAt: new Date() } }
);
console.log('modified:', r.modifiedCount);
await mongoose.disconnect();
