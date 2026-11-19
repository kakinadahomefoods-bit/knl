import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { Order, Payment } from '@/lib/models';
import { finalizePayment } from '@/lib/fulfillment';
import { razorpayWebhookConfigured } from '@/lib/config';

export const runtime = 'nodejs';

function safeEqual(a: string, b: string) {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: Request) {
  if (!razorpayWebhookConfigured()) return Response.json({ error: 'Not configured' }, { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET as string).update(raw).digest('hex');
  if (!safeEqual(sig, expected)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  try {
    const event = JSON.parse(raw);
    const eventName = String(event?.event || '');

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const pay = event.payload?.payment?.entity;
      const orderId = String(pay?.order_id || event.payload?.order?.entity?.id || '');
      if (orderId) {
        await db();
        const order = await Order.findOne({ razorpayOrderId: orderId });
        // Never let a webhook finalize a locally simulated order.
        if (order && !order.simulation) {
          const expectedAmount = Math.round((order.total || 0) * 100);
          const amountOk = pay?.amount == null || Number(pay.amount) === expectedAmount;
          const currencyOk = pay?.currency == null || String(pay.currency).toUpperCase() === 'INR';
          if (!amountOk || !currencyOk) {
            console.error('[webhook] amount/currency mismatch for order', orderId);
            return Response.json({ error: 'Payment amount mismatch' }, { status: 409 });
          }
          await finalizePayment(orderId, {
            paymentId: pay?.id,
            signatureVerified: true,
            method: pay?.method,
          });
        }
      }
    } else if (eventName === 'payment.failed') {
      const pay = event.payload?.payment?.entity;
      const orderId = String(pay?.order_id || '');
      if (orderId) {
        await db();
        const order = await Order.findOne({ razorpayOrderId: orderId });
        if (order && !order.simulation) {
          await Payment.updateOne(
            { razorpayOrderId: orderId },
            {
              $set: {
                ...(pay?.id ? { razorpayPaymentId: pay.id } : {}),
                status: 'failed',
                method: pay?.method,
                signatureVerified: true,
              },
            }
          );
        }
      }
    }
    return Response.json({ ok: true });
  } catch {
    console.error('[webhook] processing failed');
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
