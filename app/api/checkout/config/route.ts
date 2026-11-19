import { paymentSimulationEnabled, razorpayConfigured } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ available: razorpayConfigured() || paymentSimulationEnabled() }, { headers: { 'Cache-Control': 'no-store' } });
}
