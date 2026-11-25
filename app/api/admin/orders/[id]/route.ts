import { db } from '@/lib/db';
import { Order, Payment } from '@/lib/models';
import { isAdmin, adminDenied, clean } from '@/lib/security';
import { notifyOrder, deliveryEmail } from '@/lib/email';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

const FULFILLMENT = new Set([
  'new_order', 'payment_verified', 'processing', 'review_required', 'shipment_created',
  'shipment_created_simulated', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded',
  'partially_refunded', 'shipment_failed',
]);

type C = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, c: C) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  const x = await req.json().catch(() => ({}));
  const changes: Record<string, unknown> = {};
  if (typeof x.fulfillmentStatus === 'string' && FULFILLMENT.has(x.fulfillmentStatus)) {
    changes.fulfillmentStatus = x.fulfillmentStatus;
    if (x.fulfillmentStatus === 'delivered' && x.awb) changes['shipment.status'] = 'delivered';
  }
  if (typeof x.notes === 'string') changes.notes = clean(x.notes, 2000);
  if (!Object.keys(changes).length) return Response.json({ error: 'No valid changes' }, { status: 400 });
  await db();
  const order = await Order.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean() as any;
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (x.fulfillmentStatus === 'delivered' && order.customer?.email) {
    const { subject, html, text } = deliveryEmail(order);
    await notifyOrder(order._id, 'delivery', { to: order.customer.email, subject, html, text });
  }
  return Response.json({ order: { ...order, _id: String(order._id) } });
}

export async function GET(_: Request, c: C) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  await db();
  const order = await Order.findById(id).lean() as any;
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  const payment = await Payment.findOne({
    $or: [
      { orderId: order._id },
      { razorpayOrderId: order.razorpayOrderId },
    ],
  }).sort({ createdAt: -1 }).lean() as any;
  return Response.json({ order: { ...order, _id: String(order._id) }, payment: payment ? { ...payment, _id: String(payment._id) } : null });
}
