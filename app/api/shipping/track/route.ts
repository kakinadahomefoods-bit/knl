import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { trackShipment, delhiveryConfigured, simulatedTracking } from '@/lib/delhivery';
import { shippingSimulationEnabled } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  const awb = new URL(req.url).searchParams.get('awb');
  if (!awb || !/^[a-zA-Z0-9-]{5,40}$/.test(awb)) return Response.json({ error: 'Invalid AWB' }, { status: 400 });

  if (!delhiveryConfigured()) {
    if (!shippingSimulationEnabled()) return Response.json({ error: 'Delhivery not configured' }, { status: 503 });
    await db();
    const order = await Order.findOne({ 'shipment.awb': awb }).lean() as any;
    if (!order) return Response.json({ error: 'Unknown simulated AWB' }, { status: 404 });
    return Response.json(simulatedTracking(awb, order.shipment?.updates?.length || 1));
  }

  const result = await trackShipment(awb);
  return Response.json(result.data, { status: result.ok ? 200 : 502 });
}
