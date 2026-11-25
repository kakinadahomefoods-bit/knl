import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { trackShipment, delhiveryConfigured, simulatedTracking } from '@/lib/delhivery';
import { shippingSimulationEnabled } from '@/lib/config';
import { normalizeTracking } from '@/lib/shipping';

export const runtime = 'nodejs';

function parseDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function mapFulfillment(status: string): string | null {
  const s = status.toLowerCase();
  if (s.includes('delivered')) return 'delivered';
  if (s.includes('out for delivery')) return 'out_for_delivery';
  if (s.includes('transit') || s.includes('dispatched') || s.includes('shipped') || s.includes('picked up')) return 'shipped';
  return null;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  const awb = new URL(req.url).searchParams.get('awb');
  if (!awb || !/^[a-zA-Z0-9-]{5,40}$/.test(awb)) return Response.json({ error: 'Invalid AWB' }, { status: 400 });

  if (!delhiveryConfigured()) {
    if (!shippingSimulationEnabled()) return Response.json({ error: 'Delhivery not configured' }, { status: 503 });
    await db();
    const order = await Order.findOne({ 'shipment.awb': awb }).lean() as any;
    if (!order) return Response.json({ error: 'Unknown simulated AWB' }, { status: 404 });
    const simulated = simulatedTracking(awb, order.shipment?.updates?.length || 1);
    return Response.json(simulated);
  }

  const result = await trackShipment(awb);
  if (!result.ok) {
    return Response.json(result.data, { status: 502 });
  }

  const normalized = normalizeTracking(result.data);
  await db();
  const order = await Order.findOne({ 'shipment.awb': awb });
  if (order) {
    const timeline = normalized.timeline.map((event) => ({
      status: event.status,
      location: event.location,
      at: parseDate(event.at),
    }));
    const trackingEvents = normalized.timeline.map((event) => ({
      status: event.status,
      location: event.location,
      description: normalized.description,
      at: parseDate(event.at),
    }));
    order.shipment = order.shipment || {};
    order.shipment.status = normalized.status || order.shipment.status;
    order.shipment.updates = timeline.length ? timeline : order.shipment.updates;
    order.shipment.trackingEvents = trackingEvents.length ? trackingEvents : order.shipment.trackingEvents;
    const nextStatus = mapFulfillment(normalized.status || '');
    if (nextStatus) order.fulfillmentStatus = nextStatus;
    await order.save();
  }

  return Response.json({ configured: true, ok: true, data: normalized });
}