import { db } from '@/lib/db';
import { Order, Product } from '@/lib/models';
import { isAdmin, adminDenied, clean } from '@/lib/security';
import mongoose from 'mongoose';
import { sendEmail, refundEmail } from '@/lib/email';

export async function POST(req: Request, c: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return adminDenied();
  const { id } = await c.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    await db();
    const body = await req.json().catch(() => ({}));
    const order = await Order.findById(id);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') {
      return Response.json({ error: 'Only paid orders can be refunded' }, { status: 400 });
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return Response.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }
    const remaining = Math.max(0, order.total - (order.refundAmount || 0));
    const amount = body.amount != null ? Number(body.amount) : remaining;
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.0001) {
      return Response.json({ error: 'Invalid refund amount' }, { status: 400 });
    }
    if (!order.razorpayPaymentId) {
      return Response.json({ error: 'Missing Razorpay payment id' }, { status: 400 });
    }
    const auth = Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(order.razorpayPaymentId) + '/refund', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(amount * 100), speed: 'normal', notes: { reason: clean(body.reason || 'admin refund', 200) } }),
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ error: 'Refund failed', details: data }, { status: 502 });

    const newRefundTotal = (order.refundAmount || 0) + amount;
    const fullyRefunded = newRefundTotal >= order.total - 0.0001;
    order.refundAmount = newRefundTotal;
    order.refundedAt = new Date();
    order.paymentStatus = fullyRefunded ? 'refunded' : 'partially_refunded';
    if (fullyRefunded) order.fulfillmentStatus = 'refunded';

    // Restock inventory on full refund if committed and not already restocked.
    if (fullyRefunded && order.inventoryCommitted && order.inventoryMode !== 'unlimited' && !order.restocked) {
      for (const item of order.items) {
        await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.qty } });
      }
      order.restocked = true;
    }
    await order.save();

    if (order.customer?.email) {
      const { subject, html, text } = refundEmail(order, amount);
      await sendEmail({ to: order.customer.email, subject, html, text });
    }
    return Response.json({ ok: true, refund: data, order });
  } catch (e) {
    console.error('Refund error', e);
    return Response.json({ error: 'Refund unavailable' }, { status: 500 });
  }
}
