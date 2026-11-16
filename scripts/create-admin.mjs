import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const uri = process.env.MONGODB_URI;
if (!uri) throw Error('Set MONGODB_URI first');

let email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
let password = process.env.ADMIN_PASSWORD || '';

if (!email || !password) {
  const rl = createInterface({ input, output });
  if (!email) email = (await rl.question('Admin email: ')).trim().toLowerCase();
  if (!password) password = await rl.question('Admin password (minimum 12 chars): ');
  rl.close();
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Enter a valid admin email');
if (password.length < 12) throw Error('Password must be at least 12 characters');

const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
await mongoose.connect(uri);
await mongoose.connection.collection('admins').updateOne(
  { email },
  { $set: { email, passwordHash, role: 'owner' } },
  { upsert: true }
);
await mongoose.disconnect();
console.log('Admin configured for', email);
