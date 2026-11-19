import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const images = [
  '/products/dry-fruits-cookies-250g-pack-of-5-1.png',
  '/products/dry-fruits-cookies-250g-pack-of-5-2.png',
];
const r = await mongoose.connection.collection('products').updateOne(
  { slug: 'dry-fruits-cookies-250g-pack-of-5' },
  { $set: { images, updatedAt: new Date() } }
);
console.log('modified:', r.modifiedCount);
await mongoose.disconnect();
