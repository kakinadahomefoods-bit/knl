import { isAdmin, adminDenied, clean } from '@/lib/security';
import { db } from '@/lib/db';
import { Order, Product } from '@/lib/models';
import { notifyOrder, cancellationEmail } from '@/lib/email';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function POST(req: Request, c: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  await db();
  const order = await Order.findById(id);
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.fulfillmentStatus)) {
    return Response.json({ error: 'This order can no longer be cancelled' }, { status: 409 });
  }
  if (order.shipment?.awb && !order.shipment.simulated) {
    return Response.json({ error: 'Cancel the live shipment in Delhivery first' }, { status: 409 });
  }

  if (order.inventoryCommitted && !order.restocked) {
    for (const item of order.items) {
      await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.qty } });
    }
    order.restocked = true;
  }
  order.fulfillmentStatus = 'cancelled';
  order.notes = [order.notes, clean(body.reason, 500)].filter(Boolean).join(' | ');
  await order.save();

  if (order.customer?.email) {
    const { subject, html, text } = cancellationEmail(order, body.reason);
    await notifyOrder(order._id, 'cancellation', { to: order.customer.email, subject, html, text });
  }
  return Response.json({
    ok: true,
    guidance: 'If payment was captured, process a refund from the Orders tab.',
    order,
  });
}
