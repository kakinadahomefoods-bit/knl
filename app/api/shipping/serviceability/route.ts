import { serviceability } from '@/lib/delhivery';

export async function GET(req: Request) {
  const pin = new URL(req.url).searchParams.get('pin') || '';
  if (!/^\d{6}$/.test(pin)) return Response.json({ error: 'Enter a valid six-digit PIN' }, { status: 400 });
  try {
    const result = await serviceability(pin);
    if (!result.configured) return Response.json({ error: 'Delhivery not configured' }, { status: 503 });
    return Response.json({ serviceable: result.serviceable, details: result.details });
  } catch {
    return Response.json({ error: 'Unable to verify serviceability' }, { status: 503 });
  }
}
