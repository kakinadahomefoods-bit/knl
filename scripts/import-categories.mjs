import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
const cats = [
  { name: 'Cookies', slug: 'cookies', sortOrder: 1, published: true, description: 'Small-batch cookies baked with love.' },
];
await mongoose.connect(uri);
const col = mongoose.connection.collection('categories');
for (const c of cats) {
  await col.updateOne({ slug: c.slug }, { $set: c }, { upsert: true });
}
console.log('Imported', cats.length, 'categories');
await mongoose.disconnect();
