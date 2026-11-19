import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { Order, Payment } from '@/lib/models';
import { finalizePayment } from '@/lib/fulfillment';
import { paymentSimulationEnabled, razorpayConfigured } from '@/lib/config';
import { simulationSignature } from '@/lib/simulation';

export const runtime = 'nodejs';

function safeEqual(a: string, b: string) {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: Request) {
  try {
    const x = await req.json().catch(() => ({}));
    const orderId = String(x.razorpay_order_id || '');
    const paymentId = String(x.razorpay_payment_id || '');
    const signature = String(x.razorpay_signature || '');
    if (!orderId || !paymentId) return Response.json({ error: 'Invalid payment response' }, { status: 400 });

    await db();
    const order = await Order.findOne({ razorpayOrderId: orderId });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    // A dev-simulated order can only be finalized through the simulation path.
    if (order.simulation) {
      if (!paymentSimulationEnabled() || x.simulation !== true) {
        return Response.json({ error: 'Simulation payments are not available' }, { status: 403 });
      }
      if (!safeEqual(simulationSignature(orderId, paymentId), signature)) {
        return Response.json({ error: 'Invalid simulation signature' }, { status: 401 });
      }
      const finalized = await finalizePayment(orderId, {
        paymentId,
        simulation: true,
        signatureVerified: true,
        method: 'simulation',
      });
      return Response.json({
        ok: true,
        number: finalized?.number || order.number,
        trackingToken: finalized?.trackingToken || order.trackingToken,
        status: 'captured',
        simulation: true,
      });
    }

    if (!razorpayConfigured()) return Response.json({ error: 'Not configured' }, { status: 503 });
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(orderId + '|' + paymentId)
      .digest('hex');
    if (!safeEqual(signature, expected)) return Response.json({ error: 'Invalid signature' }, { status: 401 });

    const auth = Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(paymentId), {
      headers: { Authorization: 'Basic ' + auth },
      cache: 'no-store',
    });
    if (!r.ok) return Response.json({ error: 'Gateway verification unavailable' }, { status: 502 });
    const payment = await r.json();
    if (
      payment.order_id !== order.razorpayOrderId ||
      payment.amount !== Math.round(order.total * 100) ||
      String(payment.currency || '').toUpperCase() !== 'INR' ||
      !['captured', 'authorized'].includes(payment.status)
    ) {
      return Response.json({ error: 'Payment not confirmed' }, { status: 409 });
    }

    await Payment.updateOne(
      { razorpayOrderId: orderId },
      {
        $set: {
          razorpayPaymentId: paymentId,
          status: payment.status,
          method: payment.method,
          signatureVerified: true,
        },
      }
    );

    if (payment.status === 'captured') {
      const finalized = await finalizePayment(orderId, {
        paymentId,
        signatureVerified: true,
        method: payment.method,
      });
      return Response.json({
        ok: true,
        number: finalized?.number || order.number,
        trackingToken: finalized?.trackingToken || order.trackingToken,
        status: payment.status,
        simulation: false,
      });
    }
    return Response.json({ ok: true, status: 'authorized', number: order.number, simulation: false });
  } catch {
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
