import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
await mongoose.connect(uri);
const products = mongoose.connection.collection('products');
const r = await products.updateMany({}, { $set: { images: [], updatedAt: new Date() } });
console.log('products updated:', r.modifiedCount);
await mongoose.disconnect();
