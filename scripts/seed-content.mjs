/**
 * Upserts default website content and categories.
 * Uses $setOnInsert only: existing MongoDB records are never overwritten.
 */
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) throw Error('Set MONGODB_URI first');

const defaults = {
  settings: {
    storeName: 'Cruvita Cookies',
    email: 'cruvitacookies7@gmail.com',
    phone: '+91 93904 29016',
    whatsapp: '+91 93904 29016',
    address: '30/536D2, Gandhi Nagar, Nandyal Rural, Nandyal R.S., Nandyal, Andhra Pradesh – 518502, India',
    fssaiLicense: '23625014000747',
    about: 'Cruvita Cookies brings sweet moments to your doorstep with thoughtfully baked cookies, brownies and gift boxes.',
    announcement: 'Sweet moments, freshly baked • Cruvita Cookies',
    freeShippingThreshold: 999,
    flatShippingFee: 80,
    // Shipping method controls. Flat fee is an already-approved store rule and is
    // used for manual fulfilment when Delhivery is disabled or unavailable.
    delhiveryEnabled: false,
    fallbackShippingMethod: 'flat_fee',
    logo: '',
    seoTitle: 'Cruvita Cookies | Baked with Love',
    seoDescription: 'Cookies, brownies and gift boxes from Cruvita Cookies.',
    shippingPolicy: 'Shipping policy has not been published yet. Please contact us for details.',
    refundPolicy: 'Refund policy has not been published yet. Please contact us for details.',
    privacyPolicy: 'Privacy policy has not been published yet. Please contact us for details.',
    termsPolicy: 'Terms and conditions have not been published yet. Please contact us for details.',
  },
  homepage: {
    eyebrow: 'FRESHLY BAKED JOY',
    title: 'A little bite of',
    subtitle: 'happiness.',
    image: '',
  },
};

await mongoose.connect(uri);
for (const [key, value] of Object.entries(defaults)) {
  await mongoose.connection.collection('contents').updateOne({ key }, { $setOnInsert: { key, value, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
}
// Fill in any newly introduced settings keys without overwriting existing values.
const shippingDefaults = { delhiveryEnabled: false, fallbackShippingMethod: 'flat_fee' };
const current = await mongoose.connection.collection('contents').findOne({ key: 'settings' });
if (current?.value && typeof current.value === 'object') {
  const addition = {};
  for (const [key, value] of Object.entries(shippingDefaults)) {
    if (!(key in current.value)) addition[`value.${key}`] = value;
  }
  if (Object.keys(addition).length) {
    await mongoose.connection.collection('contents').updateOne({ key: 'settings' }, { $set: addition });
  }
}

for (const [index, name] of ['Cookies'].entries()) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await mongoose.connection.collection('categories').updateOne(
    { slug },
    { $setOnInsert: { name, slug, description: '', image: '', publicId: '', sortOrder: index, published: true, createdAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  );
}
await mongoose.disconnect();
console.log('Default content and categories ensured (existing records untouched).');
