import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Payment } from '@/lib/models';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAdmin())) return adminDenied();
  await db();
  const payments = await Payment.find().sort({ createdAt: -1 }).limit(300).lean();
  return Response.json({
    payments: payments.map((p: any) => ({ ...p, _id: String(p._id), orderId: String(p.orderId) })),
  });
}
