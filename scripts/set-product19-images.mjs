import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const images = [
  '/products/choco-chip-butter-cake-300g-1.png',
  '/products/choco-chip-butter-cake-300g-2.png',
  '/products/choco-chip-butter-cake-300g-3.png',
  '/products/choco-chip-butter-cake-300g-4.png',
];
const r = await mongoose.connection.collection('products').updateOne(
  { slug: 'choco-chip-butter-cake-300g' },
  { $set: { images, updatedAt: new Date() } }
);
console.log('modified:', r.modifiedCount);
await mongoose.disconnect();
