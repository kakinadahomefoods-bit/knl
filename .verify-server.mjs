// Temporary local server for browser verification (throwaway DB, no live payments/courier).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()])
);
const u = new URL(env.MONGODB_URI);
u.pathname = '/cruvita_browser_verify';
const uri = u.toString();
const port = 3011;

await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
const db = mongoose.connection.db;
await db.dropDatabase();
const now = new Date();
const products = ['Chocolate Chip Cookies', 'Fudge Brownies', 'Gift Box'].map((name, i) => ({
  _id: new mongoose.Types.ObjectId(), name, slug: 'verify-' + i, category: ['Cookies', 'Brownies', 'Gift Boxes'][i],
  description: 'Freshly baked ' + name, price: [299, 349, 799][i], stock: 20, images: [], tags: [],
  featured: i === 0, published: true, createdAt: now, updatedAt: now,
}));
await db.collection('products').insertMany(products);
await db.collection('contents').insertOne({
  key: 'settings',
  value: { storeName: 'Cruvita Cookies', freeShippingThreshold: 999, flatShippingFee: 80, delhiveryEnabled: false, fallbackShippingMethod: 'flat_fee', phone: '+91 93904 29016', email: 'cruvitacookies7@gmail.com', address: 'Nandyal, Andhra Pradesh 518502', fssaiLicense: '23625014000747' },
  createdAt: now, updatedAt: now,
});
await db.collection('coupons').insertOne({
  code: 'WELCOME10', type: 'percent', value: 10, minOrder: 0, maxDiscount: 200,
  enabled: true, usageLimit: 100, used: 0, createdAt: now, updatedAt: now,
});
await mongoose.disconnect();
console.log('Seeded throwaway DB. Product IDs:', products.map(p => String(p._id)).join(','));

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
  env: {
    ...process.env, ...env,
    MONGODB_URI: uri,
    RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '', RAZORPAY_WEBHOOK_SECRET: '',
    DELHIVERY_API_TOKEN: '', ALLOW_DEV_SIMULATION: 'true',
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', d => process.stdout.write('[next] ' + d));
child.stderr.on('data', d => process.stderr.write('[next:err] ' + d));
console.log('Dev server starting on http://localhost:' + port);
process.on('SIGTERM', async () => {
  child.kill('SIGTERM');
  try { await mongoose.connect(uri); await mongoose.connection.db.dropDatabase(); await mongoose.disconnect(); } catch {}
  process.exit(0);
});
