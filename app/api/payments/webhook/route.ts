import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { finalizePayment } from '@/lib/fulfillment';
import { razorpayWebhookConfigured } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!razorpayWebhookConfigured()) return Response.json({ error: 'Not configured' }, { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET as string).update(raw).digest('hex');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  try {
    const event = JSON.parse(raw);
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const pay = event.payload?.payment?.entity;
      const orderId = String(pay?.order_id || event.payload?.order?.entity?.id || '');
      if (orderId) {
        await db();
        const order = await Order.findOne({ razorpayOrderId: orderId });
        // Never let a webhook finalize a locally simulated order.
        if (order && !order.simulation) {
          await finalizePayment(orderId, {
            paymentId: pay?.id,
            signatureVerified: true,
            method: pay?.method,
          });
        }
      }
    }
    return Response.json({ ok: true });
  } catch {
    console.error('[webhook] processing failed');
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
