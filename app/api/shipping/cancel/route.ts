import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { delhiveryConfigured } from '@/lib/config';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

/** Cancels locally created simulated shipments. Live cancellation requires manual owner action. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  const { orderId } = await req.json().catch(() => ({}));
  if (!mongoose.isValidObjectId(String(orderId))) return Response.json({ error: 'Invalid order id' }, { status: 400 });
  await db();
  const order = await Order.findById(orderId);
  if (!order?.shipment?.awb) return Response.json({ error: 'No shipment to cancel' }, { status: 404 });
  if (!order.shipment.simulated) {
    return Response.json(
      {
        error: 'Live shipments cannot be cancelled automatically',
        guidance: delhiveryConfigured()
          ? 'Cancel this AWB in the Delhivery dashboard, then update the order status manually.'
          : 'Delhivery is not configured.',
      },
      { status: 501 }
    );
  }
  order.shipment.status = 'cancelled (simulated)';
  order.shipment.updates?.push({ status: 'Cancelled (simulated)', location: 'Cruvita Cookies studio', at: new Date() });
  order.fulfillmentStatus = 'cancelled';
  await order.save();
  return Response.json({ ok: true, simulated: true, awb: order.shipment.awb });
}
