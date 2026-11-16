import { db } from '@/lib/db';
import { Admin } from '@/lib/models';
import { verifyPassword, sign } from '@/lib/security';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  let input: any;
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: 'Invalid login request' }, { status: 400 });
  }
  if (typeof input?.email !== 'string' || typeof input?.password !== 'string' ||
      input.email.length > 254 || input.password.length > 1024) {
    return Response.json({ error: 'Invalid login request' }, { status: 400 });
  }
  if (!process.env.MONGODB_URI || !process.env.ADMIN_SESSION_SECRET) {
    console.error('[admin/login] Server configuration missing: MONGODB_URI or ADMIN_SESSION_SECRET');
    return Response.json({ error: 'Admin login is not configured. Contact the site administrator.' }, { status: 503 });
  }

  try {
    await db();
    const user = await Admin.findOne({ email: input.email.trim().toLowerCase() });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const payload = Buffer.from(JSON.stringify({ id: String(user._id), exp: Date.now() + 8 * 3600000 })).toString('base64url');
    (await cookies()).set('cruvita_admin', payload + '.' + sign(payload), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 8 * 3600,
    });
    return Response.json({ ok: true });
  } catch (error) {
    // Log only the error class, never the URI, credentials, or driver message.
    console.error('[admin/login] Login service failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Login service temporarily unavailable. Check server logs and database connectivity.' }, { status: 503 });
  }
}
