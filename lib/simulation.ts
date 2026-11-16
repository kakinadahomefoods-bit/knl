import crypto from 'node:crypto';

/**
 * Development-only stand-ins for external providers. Every generated identifier
 * is prefixed `sim_` so simulated data is always obvious in the UI and database.
 * These functions must never be called from production code paths.
 */

export function simulationPaymentId(receipt: string): string {
  const hash = crypto.createHash('sha256').update(receipt + ':' + Date.now() + ':' + crypto.randomUUID()).digest('hex');
  return 'sim_pay_' + hash.slice(0, 20);
}

export function simulationOrderId(receipt: string): string {
  const hash = crypto.createHash('sha256').update('order:' + receipt + ':' + crypto.randomUUID()).digest('hex');
  return 'sim_order_' + hash.slice(0, 20);
}

export function simulationSignature(orderId: string, paymentId: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || 'cruvita-local-simulation-only';
  return crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId + '|simulation').digest('hex');
}

export function simulationAwb(): string {
  return 'SIM' + crypto.randomInt(100000000, 999999999);
}

export function simulationTrackingSteps(): { status: string; location: string }[] {
  return [
    { status: 'Manifest generated (simulated)', location: 'Cruvita Cookies studio' },
    { status: 'Picked up (simulated)', location: 'Local pickup hub' },
    { status: 'In transit (simulated)', location: 'Sorting centre' },
    { status: 'Out for delivery (simulated)', location: 'Customer city' },
    { status: 'Delivered (simulated)', location: 'Customer address' },
  ];
}
