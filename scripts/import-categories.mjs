import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
const cats = [
  { name: 'Cookies', slug: 'cookies', sortOrder: 1, published: true, description: 'Small-batch cookies baked with love.' },
  { name: 'Brownies', slug: 'brownies', sortOrder: 2, published: true, description: 'Rich, fudgy chocolate brownies.' },
  { name: 'Gift Boxes', slug: 'gift-boxes', sortOrder: 3, published: true, description: 'Beautifully boxed treats for gifting.' },
];
await mongoose.connect(uri);
const col = mongoose.connection.collection('categories');
for (const c of cats) {
  // Never overwrite an existing category record.
  await col.updateOne(
    { slug: c.slug },
    { $setOnInsert: { ...c, image: '', publicId: '', createdAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  );
}
console.log('Ensured', cats.length, 'categories (existing records untouched).');
await mongoose.disconnect();
