// Integration checks against an isolated temporary MongoDB and local production server.
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const secret = 'isolated-test-secret-not-for-production';
const email = 'owner@example.test';
const password = 'OnlyForIsolatedTests123!';
const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri();
await mongoose.connect(uri);
const admin = await mongoose.connection.collection('admins').insertOne({ email, passwordHash: await bcrypt.hash(password, 12), role: 'owner' });
await mongoose.disconnect();
const servers = [];

async function start(port, overrides = {}) {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
    env: { ...process.env, MONGODB_URI: uri, ADMIN_SESSION_SECRET: secret, ...overrides }, stdio: 'ignore',
  });
  servers.push(child);
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/admin/session')).ok) return base; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error('Test server did not start');
}
const login = (base, body) => fetch(base + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
try {
  const base = await start(3124);
  assert.equal((await login(base, {})).status, 400);
  assert.equal((await login(base, { email, password: 'incorrect' })).status, 401);
  assert.equal((await fetch(base + '/api/admin/metrics')).status, 401);
  const ok = await login(base, { email, password });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie').split(';')[0];
  assert.match(ok.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(ok.headers.get('set-cookie'), /Secure/i);
  assert.equal((await fetch(base + '/api/admin/metrics', { headers: { cookie } })).status, 200);
  for (const endpoint of ['/api/products?admin=1', '/api/admin/categories', '/api/admin/orders', '/api/admin/coupons', '/api/admin/banners', '/api/admin/media', '/api/admin/settings']) {
    assert.equal((await fetch(base + endpoint, { headers: { cookie } })).status, 200, endpoint);
  }
  const stored = await (await fetch(base + '/api/admin/session', { headers: { cookie } })).json();
  assert.equal(stored.authenticated, true);
  const payload = Buffer.from(JSON.stringify({ id: String(admin.insertedId), exp: Date.now() - 1000, version: 'expired' })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  assert.equal((await (await fetch(base + '/api/admin/session', { headers: { cookie: `cruvita_admin=${payload}.${signature}` } })).json()).authenticated, false);
  const logout = await fetch(base + '/api/admin/logout', { method: 'POST', headers: { cookie } });
  assert.match(logout.headers.get('set-cookie'), /cruvita_admin=;/);
  assert.equal((await (await fetch(base + '/api/admin/session', { headers: { cookie } })).json()).authenticated, false);
  assert.equal((await (await fetch(base + '/api/admin/session')).json()).authenticated, false);
  const limitedEmail = 'ratelimit@example.test';
  for (let i = 0; i < 10; i++) assert.equal((await login(base, { email: limitedEmail, password: 'invalid' })).status, 401);
  assert.equal((await login(base, { email: limitedEmail, password: 'invalid' })).status, 429);
  const missing = await start(3125, { ADMIN_SESSION_SECRET: '' });
  assert.equal((await login(missing, { email, password })).status, 503);
  const unavailable = await start(3126, { MONGODB_URI: 'mongodb://127.0.0.1:1/unavailable' });
  assert.equal((await login(unavailable, { email, password })).status, 503);
  console.log('Admin authentication integration checks passed');
} finally {
  for (const child of servers) child.kill();
  await mongo.stop();
}
