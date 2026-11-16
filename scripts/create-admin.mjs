// Run in a trusted terminal with ADMIN_EMAIL and ADMIN_PASSWORD set in the
// process environment. Use --change-password and ADMIN_CURRENT_PASSWORD to
// change an existing account. This script never exposes a public endpoint.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const uri = process.env.MONGODB_URI;
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const changing = process.argv.includes('--change-password');
if (!uri) throw Error('Set MONGODB_URI first');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Set a valid ADMIN_EMAIL');
if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw Error('ADMIN_PASSWORD must be at least 12 characters and at most 72 UTF-8 bytes');

async function verifyExisting(input, stored) {
  if (typeof stored !== 'string') return false;
  if (/^\$2[aby]\$/.test(stored)) return Buffer.byteLength(input, 'utf8') <= 72 && bcrypt.compare(input, stored);
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(stored)) return false;
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(crypto.scryptSync(input, salt, 64), Buffer.from(hash, 'hex'));
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const admins = mongoose.connection.collection('admins');
  if (changing) {
    const existing = await admins.findOne({ email });
    if (!existing || !(await verifyExisting(process.env.ADMIN_CURRENT_PASSWORD || '', existing.passwordHash))) throw Error('Current credentials are invalid');
    const result = await admins.updateOne({ _id: existing._id, passwordHash: existing.passwordHash }, { $set: { passwordHash: await bcrypt.hash(password, 12) } });
    if (!result.modifiedCount) throw Error('Account changed concurrently; retry');
    console.log('Admin password updated');
  } else {
    // The singleton lock prevents simultaneous initialization scripts from creating two owners.
    const locks = mongoose.connection.collection('admin_setup_locks');
    try { await locks.insertOne({ _id: 'initial-admin' }); }
    catch (error) { if (error?.code === 11000) throw Error('Initial admin setup already completed or in progress'); throw error; }
    try {
      if (await admins.countDocuments({}) > 0) throw Error('An administrator already exists; no changes made');
      await admins.createIndex({ email: 1 }, { unique: true });
      await admins.insertOne({ email, passwordHash: await bcrypt.hash(password, 12), role: 'owner' });
    } catch (error) {
      await locks.deleteOne({ _id: 'initial-admin' });
      throw error;
    }
    console.log('Initial administrator created');
  }
} catch (error) {
  // Driver errors may contain connection details, so never print them.
  const safe = ['Set MONGODB_URI first', 'Initial admin setup already completed or in progress', 'An administrator already exists; no changes made', 'Current credentials are invalid', 'Account changed concurrently; retry'];
  console.error(safe.includes(error?.message) ? error.message : 'Administrator setup failed; check database connectivity and configuration');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
