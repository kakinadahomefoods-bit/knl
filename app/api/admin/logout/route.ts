import { cookies } from 'next/headers';
import { revokeAdminSession } from '@/lib/security';

export async function POST() {
  try {
    await revokeAdminSession();
  } catch (error) {
    console.error('[admin/logout] Session revocation failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Logout temporarily unavailable. Please try again.' }, { status: 503 });
  }
  (await cookies()).delete('cruvita_admin');
  return Response.json({ ok: true });
}
