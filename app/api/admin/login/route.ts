import { db } from '@/lib/db';
import { Admin } from '@/lib/models';
import { verifyPassword, sign, sessionVersion } from '@/lib/security';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { mongoErrorSummary } from '@/lib/mongo-diagnostics';

export async function POST(req: Request) {
  let input: any;
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: 'Invalid login request' }, { status: 400 });
  }
  if (typeof input?.email !== 'string' || typeof input?.password !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || !input.password ||
      input.email.length > 254 || input.password.length > 1024) {
    return Response.json({ error: 'Invalid login request' }, { status: 400 });
  }
  if (!process.env.MONGODB_URI || !process.env.ADMIN_SESSION_SECRET) {
    console.error('[admin/login] Server configuration missing: MONGODB_URI or ADMIN_SESSION_SECRET');
    return Response.json({ error: 'Admin login is not configured. Contact the site administrator.' }, { status: 503 });
  }

  try {
    await db();
    const email = input.email.trim().toLowerCase();
    // Shared MongoDB counters work across serverless instances. The key contains no email.
    const windowMs = 15 * 60 * 1000;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const key = crypto.createHash('sha256').update(email).digest('hex') + ':' + windowStart;
    const collection = Admin.db.collection('admin_login_limits') as import('mongodb').Collection<{ _id: string; attempts: number; expiresAt: Date }>;
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    const counter = await collection.findOneAndUpdate(
      { _id: key },
      { $inc: { attempts: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs) } },
      { upsert: true, returnDocument: 'after' }
    );
    if (counter && counter.attempts > 10) {
      return Response.json({ error: 'Too many login attempts. Please try again later.' }, {
        status: 429, headers: { 'Retry-After': String(Math.ceil((windowStart + windowMs - Date.now()) / 1000)) },
      });
    }
    const user = await Admin.findOne({ email });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    if (!user.passwordHash.startsWith('$2') && Buffer.byteLength(input.password, 'utf8') <= 72) {
      const previousHash = user.passwordHash;
      const newHash = await bcrypt.hash(input.password, 12);
      const result = await Admin.updateOne({ _id: user._id, passwordHash: previousHash }, { $set: { passwordHash: newHash } });
      if (!result.modifiedCount) {
        // Another concurrent login already migrated the hash. Re-read and verify
        // against the new value instead of failing a valid credential.
        const fresh = await Admin.findOne({ email }) as any;
        if (!fresh || !(await verifyPassword(input.password, fresh.passwordHash))) {
          return Response.json({ error: 'Please try signing in again.' }, { status: 401 });
        }
        user.passwordHash = fresh.passwordHash;
      } else {
        user.passwordHash = newHash;
      }
    }
    const exp = Date.now() + 8 * 3600000;
    const sid = crypto.randomBytes(32).toString('hex');
    const sessions = Admin.db.collection('admin_sessions');
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await sessions.insertOne({ sid, adminId: String(user._id), expiresAt: new Date(exp) });
    const payload = Buffer.from(JSON.stringify({ id: String(user._id), exp, sid, version: sessionVersion(user.passwordHash) })).toString('base64url');
    (await cookies()).set('cruvita_admin', payload + '.' + sign(payload), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 8 * 3600,
    });
    return Response.json({ ok: true });
  } catch (error) {
    // Log only the error class, never the URI, credentials, or driver message.
    console.error('[admin/login] Login service failed:', mongoErrorSummary(error));
    return Response.json({ error: 'Login service temporarily unavailable. Check server logs and database connectivity.' }, { status: 503 });
  }
}
