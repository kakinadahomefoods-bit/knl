import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { finalizePayment } from '@/lib/fulfillment';
import { paymentSimulationEnabled } from '@/lib/config';
import { simulationPaymentId } from '@/lib/simulation';

export const runtime = 'nodejs';

/**
 * DEVELOPMENT ONLY. Creates no real charge. Refuses to run in production or when
 * Razorpay credentials are configured. Finalizes a locally simulated order.
 */
export async function POST(req: Request) {
  if (!paymentSimulationEnabled()) {
    return Response.json({ error: 'Payment simulation is not available' }, { status: 403 });
  }
  try {
    const { razorpayOrderId } = await req.json().catch(() => ({}));
    if (typeof razorpayOrderId !== 'string' || !razorpayOrderId.startsWith('sim_order_')) {
      return Response.json({ error: 'Invalid simulation order' }, { status: 400 });
    }
    await db();
    const order = await Order.findOne({ razorpayOrderId });
    if (!order || !order.simulation) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.paymentStatus === 'paid') {
      return Response.json({
        ok: true,
        number: order.number,
        trackingToken: order.trackingToken,
        status: 'captured',
        simulation: true,
        alreadyFinalized: true,
      });
    }
    const paymentId = simulationPaymentId(order.number);
    const finalized = await finalizePayment(order.razorpayOrderId, {
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
  } catch {
    return Response.json({ error: 'Simulation failed' }, { status: 500 });
  }
}
