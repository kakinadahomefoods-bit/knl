import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');

await mongoose.connect(uri);
const col = mongoose.connection.collection('contents');

await col.updateOne(
  { key: 'homepage' },
  { $set: { key: 'homepage', value: {
      title: 'A little bite of',
      subtitle: 'happiness.',
      eyebrow: 'FRESHLY BAKED JOY',
      image: '/Hero_Banner.png',
    } } },
  { upsert: true }
);

await col.updateOne(
  { key: 'settings' },
  { $set: { key: 'settings', value: {
      storeName: 'Cruvita Cookies',
      email: 'cruvitacookies7@gmail.com',
      phone: '+919390429016',
      whatsapp: '+919390429016',
      address: '30/536d2, Gandhi Nagar, Nandyal Rural, Nandyal, Nandyal R.S., Nandyal, AP, IN, 518502',
      about: 'Cruvita Cookies brings sweet moments to your doorstep with thoughtfully baked cookies, brownies and gift boxes.',
      announcement: 'Sweet moments, freshly baked • Cruvita Cookies',
      freeShippingThreshold: 999,
      flatShippingFee: 80,
    } } },
  { upsert: true }
);

// Promo banners
for (const [key, img, title] of [
  ['banner:cookies-brownies', '/Cookies_Brownies_Banner.png', 'Cookies & Brownies'],
  ['banner:gift-boxes', '/Gift_Boxes_Banner.png', 'Gift Boxes'],
]) {
  await col.updateOne(
    { key },
    { $set: { key, value: { title, image: img, enabled: true } } },
    { upsert: true }
  );
}

console.log('Content imported');
await mongoose.disconnect();
