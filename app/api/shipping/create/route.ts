import { isAdmin, adminDenied } from '@/lib/security';
import { createShipmentForOrder } from '@/lib/shipping-service';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

/** Admin-triggered creation or retry. Automatic creation also runs after every
 *  verified payment; the shared claim prevents duplicate AWBs. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.orderId || '');
  if (!mongoose.isValidObjectId(orderId)) {
    return Response.json({ error: 'Invalid order id' }, { status: 400 });
  }
  const result = await createShipmentForOrder(orderId, { retry: body?.retry === true });
  if (!result.ok) {
    return Response.json(
      {
        error: result.error,
        awb: result.awb,
        alreadyCreated: Boolean(result.alreadyCreated),
        details: result.provider,
      },
      { status: result.status }
    );
  }
  return Response.json({
    ok: true,
    awb: result.awb,
    simulated: Boolean(result.simulated),
    provider: result.provider,
  });
}
