import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { finalizePayment } from '@/lib/fulfillment';
import mongoose from 'mongoose';

export async function POST(_: Request, c: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return Response.json({ error: 'Payment gateway not configured' }, { status: 503 });
  }
  try {
    await db();
    const order = await Order.findById(id);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!order.razorpayOrderId) return Response.json({ error: 'No Razorpay order' }, { status: 400 });
    const auth = Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/orders/' + encodeURIComponent(order.razorpayOrderId), {
      headers: { Authorization: 'Basic ' + auth },
      cache: 'no-store',
    });
    if (!r.ok) return Response.json({ error: 'Gateway unavailable' }, { status: 502 });
    const data = await r.json();
    if (data.status === 'paid') {
      // find a captured payment
      const pr = await fetch('https://api.razorpay.com/v1/orders/' + encodeURIComponent(order.razorpayOrderId) + '/payments', {
        headers: { Authorization: 'Basic ' + auth },
        cache: 'no-store',
      });
      const pdata = await pr.json().catch(() => ({}));
      const payment = (pdata.items || []).find((p: any) => p.status === 'captured' || p.status === 'authorized');
      await finalizePayment(order.razorpayOrderId, payment?.id);
    }
    const fresh = await Order.findById(id);
    return Response.json({ ok: true, order: fresh, gatewayStatus: data.status });
  } catch (e) {
    return Response.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
