import { quoteForCart } from '@/lib/shipping-service';

export const runtime = 'nodejs';

/**
 * Public delivery quote used by the product-page PIN checker and the checkout
 * estimate. It runs the exact same server-side path as checkout, so the amount
 * shown before payment is the amount charged after payment.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const result = await quoteForCart({
      pin: body?.pin,
      items: Array.isArray(body?.items) ? body.items : [],
      coupon: body?.coupon,
      pinOnly: body?.pinOnly === true,
    });
    return Response.json(result, { status: result.status });
  } catch {
    return Response.json({ ok: false, status: 503, serviceable: false, error: 'Delivery quote unavailable' }, { status: 503 });
  }
}
