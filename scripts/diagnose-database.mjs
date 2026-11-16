import mongoose from 'mongoose';

// Read-only diagnostics. The caller supplies MONGODB_URI through the environment
// (for local use: node --env-file=.env.local scripts/diagnose-database.mjs).
// Never print the URI, driver error messages, records, or customer information.
if (!process.env.MONGODB_URI) {
  console.error('Connection failed: MONGODB_URI is not set.');
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const database = mongoose.connection.db;
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    const products = database.collection('products');
    const admins = database.collection('admins');
    console.log(JSON.stringify({
      connected: true,
      database: database.databaseName,
      collections: collections.map((item) => item.name).sort(),
      productCount: await products.countDocuments(),
      publishedProductCount: await products.countDocuments({ published: true }),
      adminAccountCount: await admins.countDocuments(),
    }, null, 2));
  } catch (error) {
    console.error('Connection or query failed:', error instanceof Error ? error.name : 'UnknownError');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}
