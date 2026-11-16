import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { Admin } from '@/lib/models';

const secret = () => {
  if (!process.env.ADMIN_SESSION_SECRET) throw new Error('ADMIN_SESSION_SECRET missing');
  return process.env.ADMIN_SESSION_SECRET;
};

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof stored !== 'string') return false;
  if (/^\$2[aby]\$/.test(stored)) {
    // bcrypt only uses the first 72 UTF-8 bytes.
    if (Buffer.byteLength(password, 'utf8') > 72) return false;
    return bcrypt.compare(password, stored);
  }
  // Existing accounts use scrypt; migrate them only after successful verification.
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(stored)) return false;
  const [salt, hash] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

export function sign(data: string) {
  return crypto.createHmac('sha256', secret()).update(data).digest('hex');
}

export function sessionVersion(passwordHash: string) {
  return sign('admin-password:' + passwordHash);
}

function readSession(cookie: string | undefined): { id: string; exp: number; version: string; sid: string } | null {
  if (!cookie || !process.env.ADMIN_SESSION_SECRET) return null;
  const [payload, sig, extra] = cookie.split('.');
  if (!payload || !sig || extra || !/^[a-f0-9]{64}$/.test(sig)) return null;
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof obj.id !== 'string' || typeof obj.exp !== 'number' || obj.exp <= Date.now() ||
        typeof obj.version !== 'string' || typeof obj.sid !== 'string' || !/^[a-f0-9]{64}$/.test(obj.sid)) return null;
    return obj;
  } catch { return null; }
}

export async function isAdmin() {
  const cookie = (await cookies()).get('cruvita_admin')?.value;
  const obj = readSession(cookie);
  if (!obj) return false;
  try {
    await db();
    const session = await Admin.db.collection('admin_sessions').findOne({ sid: obj.sid, adminId: obj.id, expiresAt: { $gt: new Date() } });
    if (!session) return false;
    const user = await Admin.findById(obj.id).select('passwordHash').lean() as { passwordHash?: string } | null;
    return !!user?.passwordHash && obj.version === sessionVersion(user.passwordHash);
  } catch {
    return false;
  }
}

export async function revokeAdminSession() {
  const obj = readSession((await cookies()).get('cruvita_admin')?.value);
  if (!obj) return;
  await db();
  await Admin.db.collection('admin_sessions').deleteOne({ sid: obj.sid, adminId: obj.id });
}

export function adminDenied() { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
export function clean(s: unknown, max = 200) { return typeof s === 'string' ? s.trim().slice(0, max) : ''; }
