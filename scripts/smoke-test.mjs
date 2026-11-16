/**
 * End-to-end smoke test for Cruvita Cookies.
 *
 * IMPORTANT: this test never touches the real database. It reads .env.local,
 * derives a unique throwaway database name from MONGODB_URI, starts the app
 * against that database, exercises the public + admin + simulation flows, and
 * drops the throwaway database at the end. Cloudinary test uploads are deleted.
 */
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

const PORT = Number(process.env.SMOKE_PORT || (34000 + Math.floor(Math.random() * 1000)));
const BASE = 'http://127.0.0.1:' + PORT;
const results = [];
let server;
let testUri;
let serverLog = '';

function envFile() {
  const out = {};
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForServer(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(5000) });
      if (r.ok) return true;
    } catch { /* still starting */ }
    await sleep(1200);
  }
  return false;
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
    console.log('  PASS  ' + name + (detail ? ' — ' + detail : ''));
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log('  FAIL  ' + name + ' — ' + e.message);
    if ((e.message === 'fetch failed' || e.message.includes('status 500')) && serverLog) {
      console.log('  [server log tail] ' + serverLog.slice(-1200).replace(/\n/g, ' | '));
    }
  }
}

function expect(cond, message) { if (!cond) throw new Error(message); }

async function api(path, options = {}, cookie = '') {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + path, { ...options, headers, redirect: 'manual' });
  let body = null;
  try { body = await r.json(); } catch { /* non-JSON response */ }
  return { status: r.status, body, headers: r.headers };
}

async function main() {
  const env = envFile();
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI missing from .env.local');
  const dbName = 'cruvita_smoke_' + Date.now();
  const u = new URL(env.MONGODB_URI);
  u.pathname = '/' + dbName;
  testUri = u.toString();

  const adminEmail = 'smoke-' + Date.now() + '@example.test';
  const adminPassword = 'Sm0keTest!' + crypto.randomBytes(8).toString('hex');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = salt + ':' + crypto.scryptSync(adminPassword, salt, 64).toString('hex');

  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 20000 });
  await mongoose.connection.collection('admins').insertOne({ email: adminEmail, passwordHash, role: 'owner', createdAt: new Date(), updatedAt: new Date() });
  console.log('Using throwaway database:', dbName);

  rmSync('.next-smoke', { recursive: true, force: true });
  const childEnv = {
    ...process.env, ...env,
    MONGODB_URI: testUri,
    ALLOW_DEV_SIMULATION: 'true',
    NEXT_DIST_DIR: '.next-smoke',
    PORT: String(PORT),
  };
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(PORT)], {
    env: childEnv, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => { serverLog += d.toString(); });
  server.stderr.on('data', (d) => { serverLog += d.toString(); });

  const ready = await waitForServer();
  if (!ready) {
    console.error('Dev server did not start. Tail of log:\n' + serverLog.slice(-2000));
    throw new Error('Server startup failed');
  }

  let cookie = '';
  let productId = '';
  let checkout = null;
  let tracked = null;
  let awb = '';
  let uploadedPublicId = '';

  console.log('\nPublic pages and API');
  for (const path of ['/', '/shop', '/cart', '/wishlist', '/checkout', '/track', '/about', '/contact', '/policies']) {
    await check('GET ' + path, async () => {
      const r = await fetch(BASE + path);
      expect(r.status === 200, 'status ' + r.status);
      return '200';
    });
  }
  await check('GET /api/products returns database products', async () => {
    const r = await api('/api/products');
    expect(r.status === 200, 'status ' + r.status);
    expect(Array.isArray(r.body.products), 'products missing');
    return r.body.products.length + ' products';
  });
  await check('GET /api/content returns content records', async () => {
    const r = await api('/api/content');
    expect(r.status === 200 && Array.isArray(r.body.content), 'content missing');
  });
  await check('Admin API rejects anonymous access', async () => {
    const r = await api('/api/products?admin=1');
    expect(r.status === 401, 'expected 401, got ' + r.status);
    const up = await api('/api/upload', { method: 'POST' });
    expect(up.status === 401, 'upload expected 401, got ' + up.status);
  });

  console.log('\nAuthentication');
  await check('Admin login with wrong password fails', async () => {
    const r = await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: 'wrong-password' }) });
    expect(r.status === 401, 'expected 401, got ' + r.status);
  });
  await check('Admin login succeeds and sets session cookie', async () => {
    const r = await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
    expect(r.status === 200, 'status ' + r.status + ' ' + JSON.stringify(r.body));
    const raw = r.headers.get('set-cookie') || '';
    const match = raw.match(/cruvita_admin=[^;]+/);
    expect(match, 'session cookie missing');
    cookie = match[0];
  });
  await check('Session reports authenticated', async () => {
    const r = await api('/api/admin/session', {}, cookie);
    expect(r.body?.authenticated === true, 'not authenticated');
  });

  console.log('\nCatalogue and Cloudinary');
  await check('Admin creates a product in MongoDB', async () => {
    const r = await api('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Test Cookie', slug: 'smoke-test-cookie', category: 'Cookies', description: 'Temporary test product', price: 250, stock: 0, published: true }),
    }, cookie);
    expect(r.status === 201, 'status ' + r.status + ' ' + JSON.stringify(r.body));
    productId = r.body.product._id;
    expect(productId, 'no product id');
  });
  await check('Published product appears on storefront API', async () => {
    const r = await api('/api/products');
    expect(r.body.products.some((p) => p._id === productId), 'product not visible');
  });
  await check('Admin category API works', async () => {
    const r = await api('/api/admin/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Category', slug: 'smoke-category', published: true }),
    }, cookie);
    expect(r.status === 201, 'status ' + r.status);
  });
  await check('Cloudinary upload stores a managed asset', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
    form.append('folder', 'cruvita/products');
    const r = await fetch(BASE + '/api/upload', { method: 'POST', headers: { Cookie: cookie }, body: form });
    const body = await r.json().catch(() => ({}));
    if (r.status === 503 && JSON.stringify(body).includes('Upload failed')) {
      throw new Error('Cloudinary rejected the upload — verify this API key has upload/create permission (ping alone is not enough)');
    }
    expect(r.status === 200, 'status ' + r.status + ' ' + JSON.stringify(body));
    expect(body.publicId?.startsWith('cruvita/products/'), 'unexpected public id');
    uploadedPublicId = body.publicId;
  });
  if (uploadedPublicId) {
    await check('Unused Cloudinary asset can be removed', async () => {
      const r = await api('/api/admin/media', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: uploadedPublicId }),
      }, cookie);
      expect(r.status === 200, 'status ' + r.status + ' ' + JSON.stringify(r.body));
    });
  }

  console.log('\nGuest checkout, payment and shipping simulation');
  const customer = { name: 'Smoke Customer', email: 'smoke@example.test', phone: '9876543210', address: '1 Test Lane', city: 'Kurnool', state: 'Andhra Pradesh', pin: '518001' };
  await check('Checkout rejects invalid customer data', async () => {
    const r = await api('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { ...customer, phone: '123' }, items: [{ id: productId, qty: 1 }] }) });
    expect(r.status === 400, 'expected 400, got ' + r.status);
  });
  await check('Guest checkout creates a pending simulated order', async () => {
    const r = await api('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer, items: [{ id: productId, qty: 2 }], idempotencyKey: 'smoke-' + dbName }),
    });
    expect(r.status === 200, 'status ' + r.status + ' ' + JSON.stringify(r.body));
    expect(r.body.simulation === true, 'simulation flag missing');
    checkout = r.body;
    return checkout.number;
  });
  await check('Idempotency key returns the same order', async () => {
    const r = await api('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer, items: [{ id: productId, qty: 2 }], idempotencyKey: 'smoke-' + dbName }),
    });
    expect(r.body.number === checkout.number, 'duplicate order created');
  });
  await check('Simulated payment finalizes the order', async () => {
    const r = await api('/api/payments/simulate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpayOrderId: checkout.razorpayOrderId }),
    });
    expect(r.status === 200, 'status ' + r.status + ' ' + JSON.stringify(r.body));
    expect(r.body.status === 'captured', 'not captured');
  });
  await check('Guest order tracking returns paid status', async () => {
    const token = await getTrackingToken(checkout.orderId);
    const r = await api('/api/track?number=' + encodeURIComponent(checkout.number) + '&token=' + encodeURIComponent(token));
    expect(r.status === 200, 'status ' + r.status + ' ' + JSON.stringify(r.body));
    expect(r.body.order.paymentStatus === 'paid', 'order not paid');
    tracked = r.body;
  });
  await check('Unlimited order leaves tracked stock unchanged', async () => {
    const r = await api('/api/products/' + productId);
    expect(r.body.product.stock === 0, 'stock is ' + r.body.product.stock);
  });
  await check('Payment record is stored', async () => {
    const r = await api('/api/admin/payments', {}, cookie);
    expect(r.body.payments.some((p) => p.number === checkout.number && p.simulation), 'no simulated payment record');
  });
  await check('Admin creates a simulated shipment', async () => {
    const r = await api('/api/shipping/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: checkout.orderId }),
    }, cookie);
    expect(r.status === 200, 'status ' + r.status + ' ' + JSON.stringify(r.body));
    expect(r.body.simulated === true, 'not marked simulated');
    awb = r.body.awb;
  });
  await check('Simulated shipment tracking works', async () => {
    const r = await api('/api/shipping/track?awb=' + encodeURIComponent(awb), {}, cookie);
    expect(r.status === 200, 'status ' + r.status);
    expect(r.body.simulated === true, 'tracking not simulated');
  });
  await check('Webhook rejects an unsigned event', async () => {
    const r = await api('/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect([401, 503].includes(r.status), 'unexpected status ' + r.status);
  });

  async function getTrackingToken(orderId) {
    const order = await mongoose.connection.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    return order.trackingToken;
  }
}

async function stopServer() {
  if (!server?.pid) return;
  if (process.platform === 'win32') {
    try { await new Promise((resolve) => spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', resolve)); } catch { /* noop */ }
  } else {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { try { server.kill('SIGTERM'); } catch { /* noop */ } }
  }
  await sleep(1200);
}

main()
  .catch((e) => { results.push({ name: 'Setup', ok: false, detail: e.message }); console.error('SETUP FAILED:', e.message); })
  .finally(async () => {
    await stopServer();
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        console.log('\nDropped throwaway database.');
        await mongoose.disconnect();
      }
    } catch (e) { console.error('Cleanup warning:', e.message); }
    const failed = results.filter((r) => !r.ok);
    console.log('\nSummary: ' + (results.length - failed.length) + '/' + results.length + ' checks passed.');
    if (failed.length) {
      console.log('Failed checks:');
      for (const f of failed) console.log(' - ' + f.name + ': ' + f.detail);
      process.exitCode = 1;
    }
  });
