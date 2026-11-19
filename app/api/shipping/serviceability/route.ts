import { checkPinServiceability, getShippingSettings } from '@/lib/shipping-service';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const pin = new URL(req.url).searchParams.get('pin') || '';
  const settings = await getShippingSettings();
  const result = await checkPinServiceability(pin, settings);
  if (!result.serviceable && result.errorCode === 'PIN_INVALID') {
    return Response.json({ error: result.error }, { status: 400 });
  }
  if (!result.serviceable) {
    return Response.json(
      {
        // Never leak carrier configuration details to customers.
        error: result.error || 'Delivery is currently unavailable. Please contact the store.',
        errorCode: result.errorCode,
      },
      { status: result.errorCode === 'SHIPPING_UNAVAILABLE' ? 400 : 503 }
    );
  }
  return Response.json({
    serviceable: result.serviceable,
    simulated: result.simulated,
    configured: result.configured,
    method: result.mode,
    note: result.note,
    city: result.city,
    state: result.state,
    details: result.details,
  });
}
