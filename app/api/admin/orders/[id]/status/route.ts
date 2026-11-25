import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { isAdmin, adminDenied, getAdminSession, clean } from '@/lib/security';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

const TRANSITIONS: Record<string, string[]> = {
  new_order: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
  payment_verified: ['processing', 'shipped', 'delivered', 'cancelled'],
  pending: ['processing', 'shipped', 'delivered', 'cancelled'],
  processing: ['shipped', 'delivered', 'cancelled'],
  review_required: ['processing', 'shipped', 'delivered', 'cancelled'],
  shipment_created: ['shipped', 'delivered', 'cancelled'],
  shipment_created_simulated: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  refunded: [],
  partially_refunded: ['cancelled'],
  shipment_failed: ['processing', 'shipped', 'delivered', 'cancelled'],
};

type C = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, c: C) {
  if (!(await isAdmin())) return adminDenied();
  const admin = await getAdminSession();
  if (!admin) return adminDenied();

  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid order id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const nextStatus = String(body?.status || '').trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  await db();
  const order = await Order.findById(id);
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

  const current = String(order.fulfillmentStatus || 'pending');
  if (nextStatus === current) {
    return Response.json({ error: 'Order is already in this status' }, { status: 400 });
  }
  const allowed = TRANSITIONS[current] || [];
  if (!allowed.includes(nextStatus)) {
    return Response.json({ error: `Cannot move order from ${current} to ${nextStatus}` }, { status: 400 });
  }

  // Cancellation requires explicit confirmation from the client.
  if (nextStatus === 'cancelled' && body?.confirm !== true) {
    return Response.json({ error: 'Cancellation must be confirmed' }, { status: 400 });
  }

  const notes = typeof body?.notes === 'string' ? clean(body.notes, 2000) : '';
  const trackingNumber = typeof body?.trackingNumber === 'string' ? clean(body.trackingNumber, 120) : '';
  const courier = typeof body?.courier === 'string' ? clean(body.courier, 120) : '';

  const previous = current;
  order.fulfillmentStatus = nextStatus;
  if (notes) order.notes = notes;
  order.shipment = order.shipment || {};
  if (trackingNumber) order.shipment.awb = trackingNumber;
  if (courier) order.shipment.courier = courier;
  if (nextStatus === 'shipped' || nextStatus === 'delivered') {
    order.shipment.status = nextStatus;
  }
  if (!Array.isArray(order.history)) order.history = [];
  order.history.push({
    from: previous,
    to: nextStatus,
    at: new Date(),
    by: admin.email || admin.id,
    notes,
    trackingNumber,
    courier,
  });
  await order.save();

  return Response.json({ ok: true, order: { ...order.toObject(), _id: String(order._id) } });
}