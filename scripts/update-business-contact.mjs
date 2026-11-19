import mongoose from 'mongoose';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const result = await mongoose.connection.collection('contents').updateOne(
    { key: 'settings' },
    { $set: {
      'value.email': 'cruvitacookies7@gmail.com',
      'value.phone': '+91 93904 29016',
      'value.whatsapp': '+91 93904 29016',
      'value.address': '30/536D2, Gandhi Nagar, Nandyal Rural, Nandyal R.S., Nandyal, Andhra Pradesh – 518502, India',
      'value.fssaiLicense': '23625014000747',
    }, $setOnInsert: { key: 'settings' } },
    { upsert: true },
  );
  console.log(`Business contact settings updated (matched: ${result.matchedCount}, created: ${result.upsertedCount}).`);
} catch (error) {
  console.error('Unable to update contact settings:', error instanceof Error ? error.name : 'UnknownError');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
