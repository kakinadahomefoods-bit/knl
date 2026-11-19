import { db } from '@/lib/db';
import { Order, Payment } from '@/lib/models';
import { clean } from '@/lib/security';
import { formatAddress, validateCart, validateCustomer } from '@/lib/validation';
import { paymentSimulationEnabled, razorpayConfigured } from '@/lib/config';
import { simulationOrderId } from '@/lib/simulation';
import { quoteForCart } from '@/lib/shipping-service';
import Razorpay from 'razorpay';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

type CheckoutResponse = {
  orderId: string;
  number: string;
  razorpayOrderId: string;
  key: string;
  amount: number;
  currency: string;
  simulation: boolean;
  shippingSimulation: boolean;
  shipping: number;
  total: number;
  shippingMethod: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const customerError = validateCustomer(body.customer);
    if (customerError) return Response.json({ error: customerError }, { status: 400 });
    const cartError = validateCart(body.items);
    if (cartError) return Response.json({ error: cartError }, { status: 400 });

    const headerKey = req.headers.get('x-idempotency-key');
    const idempotencyKey = clean(headerKey || body.idempotencyKey, 120) || undefined;
    await db();

    // A retried request (network retry / double click) returns the original order.
    if (idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey }).lean() as any;
      if (existing) {
        return Response.json({
          orderId: String(existing._id),
          number: existing.number,
          razorpayOrderId: existing.razorpayOrderId,
          key: existing.simulation ? '' : process.env.RAZORPAY_KEY_ID || '',
          amount: Math.round((existing.total || 0) * 100),
          currency: 'INR',
          simulation: Boolean(existing.simulation),
          shippingSimulation: Boolean(existing.shipment?.simulated),
          shipping: Number(existing.shipping) || 0,
          total: Number(existing.total) || 0,
          shippingMethod: String(existing.shippingMethod || (existing.simulation ? 'simulation' : 'delhivery')),
        } satisfies CheckoutResponse);
      }
    }

    // Single authoritative quote: PIN serviceability, packed weight/dimensions and
    // the configured shipping rule. The browser estimate uses this same code path.
    const quoted = await quoteForCart({
      pin: String(body.customer.pin).trim(),
      items: body.items,
      coupon: body.coupon,
    });
    if (!quoted.ok || !quoted.pricing || !quoted.quote) {
      return Response.json(
        { error: quoted.error || 'Delivery unavailable', errorCode: quoted.errorCode },
        { status: quoted.status || 400 }
      );
    }
    const pricing = quoted.pricing;
    const quote = quoted.quote;

    const simulation = paymentSimulationEnabled();
    if (!razorpayConfigured() && !simulation) {
      console.error('[checkout] payment unavailable: required Razorpay server credentials are missing');
      return Response.json({ error: 'Online payment is temporarily unavailable. Please try again later or contact us.' }, { status: 503 });
    }

    const number = 'CC-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const amount = pricing.total;
    const razorpayOrderId = simulation
      ? simulationOrderId(number)
      : (await (async () => {
          const rzp = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID as string,
            key_secret: process.env.RAZORPAY_KEY_SECRET as string,
          });
          const created = await rzp.orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: number,
          });
          return created.id;
        })());

    try {
      const order = await Order.create({
        number,
        idempotencyKey,
        customer: {
          name: clean(body.customer.name, 120),
          email: clean(body.customer.email, 200),
          phone: clean(body.customer.phone, 20),
          houseNo: clean(body.customer.houseNo, 80),
          street: clean(body.customer.street, 200),
          landmark: clean(body.customer.landmark, 120),
          address: clean(formatAddress(body.customer), 500),
          city: clean(body.customer.city, 120),
          state: clean(body.customer.state, 120),
          pin: clean(body.customer.pin, 10),
        },
        items: pricing.items,
        inventoryMode: 'unlimited',
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        shippingMethod: quote.method,
        fulfillmentStatus: 'new_order',
        ...(quote.method === 'manual' ? { shipment: { status: 'manual_processing' } } : {}),
        shippingQuote: {
          method: quote.method,
          amount: quote.amount,
          baseAmount: quote.baseAmount,
          currency: quote.currency,
          source: quote.source,
          simulated: quote.simulated,
          serviceable: quote.serviceable,
          pickupPin: quote.pickupPin,
          destinationPin: quote.destinationPin,
          freeShippingApplied: quote.freeShippingApplied,
          note: quote.note,
          parcel: quote.parcel,
        },
        discount: pricing.discount,
        coupon: pricing.coupon,
        total: pricing.total,
        razorpayOrderId,
        simulation,
        trackingToken: crypto.randomBytes(24).toString('hex'),
      });
      await Payment.create({
        orderId: order._id,
        number,
        razorpayOrderId,
        amount: pricing.total,
        currency: 'INR',
        status: 'created',
        simulation,
      });
      return Response.json({
        orderId: String(order._id),
        number,
        razorpayOrderId,
        key: simulation ? '' : process.env.RAZORPAY_KEY_ID || '',
        amount: Math.round(amount * 100),
        currency: 'INR',
        simulation,
        shippingSimulation: quote.simulated,
        shipping: pricing.shipping,
        total: pricing.total,
        shippingMethod: quote.method,
      } satisfies CheckoutResponse);
    } catch (e: any) {
      if (e?.code === 11000 && idempotencyKey) {
        const existing = await Order.findOne({ idempotencyKey }).lean() as any;
        if (existing) {
          return Response.json({
            orderId: String(existing._id),
            number: existing.number,
            razorpayOrderId: existing.razorpayOrderId,
            key: existing.simulation ? '' : process.env.RAZORPAY_KEY_ID || '',
            amount: Math.round((existing.total || 0) * 100),
            currency: 'INR',
            simulation: Boolean(existing.simulation),
            shippingSimulation: Boolean(existing.shipment?.simulated),
            shipping: Number(existing.shipping) || 0,
            total: Number(existing.total) || 0,
            shippingMethod: String(existing.shippingMethod || (existing.simulation ? 'simulation' : 'delhivery')),
          } satisfies CheckoutResponse);
        }
      }
      throw e;
    }
  } catch (e) {
    console.error('[checkout] unexpected error:', (e as Error).message);
    return Response.json({ error: 'Checkout unavailable' }, { status: 503 });
  }
}
