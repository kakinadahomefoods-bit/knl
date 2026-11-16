import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { createShipment, delhiveryConfigured, createSimulatedShipment } from '@/lib/delhivery';
import { shippingSimulationEnabled } from '@/lib/config';
import { notifyOrder, shipmentEmail } from '@/lib/email';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  try {
    const { orderId, weight = 500, length = 20, breadth = 15, height = 10 } = await req.json().catch(() => ({}));
    if (!mongoose.isValidObjectId(String(orderId))) {
      return Response.json({ error: 'Invalid order id' }, { status: 400 });
    }
    await db();
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus !== 'paid') {
      return Response.json({ error: 'Only paid orders can be shipped' }, { status: 400 });
    }
    if (order.shipment?.awb) {
      return Response.json({ error: 'Already shipped', awb: order.shipment.awb }, { status: 409 });
    }

    let result: any;
    if (delhiveryConfigured()) {
      result = await createShipment(order, { weight, length, breadth, height });
      if (!result.ok) {
        return Response.json({ error: result.error, details: result.details }, { status: result.details ? 502 : 503 });
      }
    } else if (shippingSimulationEnabled()) {
      result = createSimulatedShipment();
    } else {
      return Response.json({ error: 'Delhivery is not configured and simulation is disabled' }, { status: 503 });
    }

    order.shipment = {
      awb: result.awb,
      status: result.simulated ? 'created (simulated)' : 'created',
      reference: order.number,
      simulated: Boolean(result.simulated),
      providerPayload: result.provider,
      labelUrl: result.provider?.label_url || result.provider?.label || '',
      updates: [
        {
          status: result.simulated ? 'Shipment created (simulated)' : 'Shipment created',
          location: 'Cruvita Cookies studio',
          at: new Date(),
        },
      ],
    };
    order.fulfillmentStatus = result.simulated ? 'shipment_created_simulated' : 'shipment_created';
    await order.save();

    if (order.customer?.email) {
      const { subject, html, text } = shipmentEmail(order, result.awb, Boolean(result.simulated));
      await notifyOrder(order._id, 'shipping', { to: order.customer.email, subject, html, text });
    }

    return Response.json({
      ok: true,
      awb: result.awb,
      provider: result.provider,
      simulated: Boolean(result.simulated),
    });
  } catch (e) {
    console.error('[shipping] create failed:', (e as Error).message);
    return Response.json({ error: 'Shipment request failed' }, { status: 502 });
  }
}
