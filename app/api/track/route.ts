import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { trackShipment, simulatedTracking } from '@/lib/delhivery';
import { delhiveryConfigured, shippingSimulationEnabled } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const number = u.searchParams.get('number');
  const token = u.searchParams.get('token');
  if (!number || !token || token.length < 20) {
    return Response.json({ error: 'Secure order link required' }, { status: 400 });
  }
  await db();
  const o = await Order.findOne({ number, trackingToken: token })
    .select('number paymentStatus fulfillmentStatus shipment createdAt simulation notifications')
    .lean() as any;
  if (!o) return Response.json({ error: 'Order not found' }, { status: 404 });

  let shipmentTracking: any = null;
  if (o.shipment?.awb) {
    if (o.shipment.simulated) {
      shipmentTracking = simulatedTracking(o.shipment.awb, o.shipment.updates?.length || 1);
      shipmentTracking.timeline = o.shipment.updates || shipmentTracking.data?.timeline;
    } else if (delhiveryConfigured()) {
      try {
        shipmentTracking = await trackShipment(o.shipment.awb);
      } catch {
        shipmentTracking = { error: 'Live tracking temporarily unavailable' };
      }
    } else if (shippingSimulationEnabled()) {
      shipmentTracking = { error: 'Live tracking unavailable; this shipment was created with live credentials.' };
    }
  }

  return Response.json({ order: o, shipmentTracking, simulation: Boolean(o.simulation) });
}
