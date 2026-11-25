import { simulationAwb, simulationTrackingSteps } from '@/lib/simulation';
import { isPrepaidServiceable } from '@/lib/shipping';

export function delhiveryBase() {
  return (process.env.DELHIVERY_API_BASE_URL || 'https://track.delhivery.com').replace(/\/$/, '');
}

export function delhiveryConfigured() {
  return Boolean(process.env.DELHIVERY_API_TOKEN);
}

/** Development-only shipment generator. Clearly tagged as simulated in every field. */
export function createSimulatedShipment() {
  const awb = simulationAwb();
  return {
    ok: true as const,
    awb,
    simulated: true as const,
    provider: {
      success: true,
      simulated: true,
      message: 'Development-only simulation. No parcel was handed to Delhivery.',
      packages: [{ waybill: awb }],
    },
  };
}

export function simulatedTracking(awb: string, step = 2) {
  const steps = simulationTrackingSteps();
  const index = Math.max(0, Math.min(steps.length - 1, step));
  return {
    configured: false,
    simulated: true,
    ok: true,
    data: {
      waybill: awb,
      simulation: true,
      status: steps[index].status,
      timeline: steps.slice(0, index + 1),
      note: 'Development-only simulation. No live courier data.',
    },
  };
}

export async function serviceability(pin: string) {
  if (!delhiveryConfigured()) return { configured: false, serviceable: false };
  const r = await fetch(delhiveryBase() + '/c/api/pin-codes/json/?filter_codes=' + encodeURIComponent(pin), {
    headers: { Authorization: 'Token ' + process.env.DELHIVERY_API_TOKEN },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('Service unavailable');
  const data = await r.json();
  return { configured: true, serviceable: isPrepaidServiceable(data, pin), details: data };
}

export async function trackShipment(awb: string) {
  if (!delhiveryConfigured()) return { configured: false };
  const r = await fetch(delhiveryBase() + '/api/v1/packages/json/?waybill=' + encodeURIComponent(awb), {
    headers: { Authorization: 'Token ' + process.env.DELHIVERY_API_TOKEN },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json().catch(() => ({}));
  return { configured: true, ok: r.ok, data };
}

export async function createShipment(order: any, meta: { weight?: number; length?: number; breadth?: number; height?: number } = {}) {
  const token = process.env.DELHIVERY_API_TOKEN;
  const pickup = process.env.DELHIVERY_PICKUP_NAME;
  if (!token || !pickup) return { ok: false, error: 'Delhivery is not configured: missing API token or pickup name' };
  const payload = {
    shipments: [{
      name: order.customer.name,
      add: order.customer.address,
      city: order.customer.city,
      state: order.customer.state,
      pin: order.customer.pin,
      phone: order.customer.phone,
      order: order.number,
      payment_mode: 'Prepaid',
      products_desc: order.items.map((i: any) => i.name).join(', ').slice(0, 250),
      cod_amount: 0,
      total_amount: order.total,
      quantity: order.items.reduce((s: number, i: any) => s + i.qty, 0),
      weight: meta.weight || 500,
      length: meta.length || 20,
      breadth: meta.breadth || 15,
      height: meta.height || 10,
    }],
    pickup_location: { name: pickup },
  };
  const r = await fetch(delhiveryBase() + '/api/cmu/create.json', {
    method: 'POST',
    headers: { Authorization: 'Token ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ format: 'json', data: JSON.stringify(payload) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.success === false) return { ok: false, error: 'Shipment rejected', details: data };
  const pkg = Array.isArray(data.packages) ? data.packages[0] || {} : {};
  const awb = pkg.waybill || pkg.awb || pkg.AWB || data.waybill || data.awb;
  if (!awb) return { ok: false, error: 'Delhivery did not return an AWB', details: data };
  const shipmentId = String(pkg.shipment_id || pkg.shipmentId || pkg.id || pkg.reference || awb);
  const labelUrl = String(pkg.label || pkg.label_url || data.label || data.label_url || '');
  const trackingUrl = `https://www.delhivery.com/track/package/${encodeURIComponent(String(awb))}`;
  return { ok: true, awb: String(awb), shipmentId, labelUrl, trackingUrl, provider: data };
}
