import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');

await mongoose.connect(uri);
const result = await mongoose.connection.collection('products').updateOne(
  { slug: 'mini-chocolate-chip-cookies' },
  { $set: { images: [], updatedAt: new Date() } }
);
console.log('matched:', result.matchedCount, 'modified:', result.modifiedCount);
await mongoose.disconnect();
