import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const images = [
  '/products/classic-chocolate-brownie-pack-of-6-1.png',
  '/products/classic-chocolate-brownie-pack-of-6-2.png',
];
const r = await mongoose.connection.collection('products').updateOne(
  { slug: 'classic-chocolate-brownie-pack-of-6' },
  { $set: { images, updatedAt: new Date() } }
);
console.log('modified:', r.modifiedCount);
await mongoose.disconnect();
