import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
try { fs.rmSync(path.join(root, '.next'), { recursive: true, force: true }); } catch {}
const port = process.env.PORT || '3010';
const baseUrl = `http://localhost:${port}`;

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const uri = replSet.getUri();
console.log('MongoMemoryServer URI:', uri);
process.env.MONGODB_URI = uri;
fs.writeFileSync(path.join(root, '.test-mongo-uri'), uri);

// seed admin
const email = (process.env.TEST_ADMIN_EMAIL || 'admin@test.cruvita.com').toLowerCase();
const password = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!';
const salt = crypto.randomBytes(16).toString('hex');
const hash = salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
await mongoose.connect(uri);
await mongoose.connection.collection('admins').updateOne({ email }, { $set: { email, passwordHash: hash, role: 'owner' } }, { upsert: true });
await mongoose.disconnect();

// spawn next dev
// Never let an end-to-end run reach live payment or courier APIs.
const env = {
  ...process.env,
  MONGODB_URI: uri,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET || 'test-secret-at-least-32-chars-long!!',
  NEXT_PUBLIC_SITE_URL: baseUrl,
  NODE_ENV: 'development',
  RAZORPAY_KEY_ID: '',
  RAZORPAY_KEY_SECRET: '',
  RAZORPAY_WEBHOOK_SECRET: '',
  DELHIVERY_API_TOKEN: '',
};
const server = spawn('npx', ['next', 'dev', '-p', String(port)], { cwd: root, env, stdio: 'inherit', shell: true });

// wait for server
async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(baseUrl);
      if (r.ok || r.status === 404) return;
    } catch {}
    await new Promise(res => setTimeout(res, 1000));
  }
  throw new Error('Server not ready');
}
await waitReady();
console.log('Server ready');

// run playwright
const pw = spawn('npx', ['playwright', 'test'], { cwd: root, env: { ...env, PLAYWRIGHT_BASE_URL: baseUrl, TEST_ADMIN_EMAIL: email, TEST_ADMIN_PASSWORD: password }, stdio: 'inherit', shell: true });
const code = await new Promise(resolve => pw.on('exit', resolve));

server.kill();
await replSet.stop();
fs.rmSync(path.join(root, '.test-mongo-uri'), { force: true });
process.exit(code || 0);
