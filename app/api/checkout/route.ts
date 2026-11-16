import { db } from '@/lib/db';
import { Order, Product, Coupon, Payment } from '@/lib/models';
import { clean } from '@/lib/security';
import { validateCart, validateCustomer } from '@/lib/validation';
import { calculatePricing } from '@/lib/pricing';
import {
  delhiveryConfigured,
  flatShippingFee,
  freeShippingThreshold,
  paymentSimulationEnabled,
  razorpayConfigured,
  shippingSimulationEnabled,
} from '@/lib/config';
import { simulationOrderId } from '@/lib/simulation';
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
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const customerError = validateCustomer(body.customer);
    if (customerError) return Response.json({ error: customerError }, { status: 400 });
    const cartError = validateCart(body.items);
    if (cartError) return Response.json({ error: cartError }, { status: 400 });

    const c = body.customer;
    const pin = String(c.pin).trim();

    // PIN serviceability: live Delhivery when configured, otherwise explicit dev simulation.
    let shippingSimulation = false;
    if (delhiveryConfigured()) {
      const base = (process.env.DELHIVERY_API_BASE_URL || 'https://track.delhivery.com').replace(/\/$/, '');
      const service = await fetch(base + '/c/api/pin-codes/json/?filter_codes=' + encodeURIComponent(pin), {
        headers: { Authorization: 'Token ' + process.env.DELHIVERY_API_TOKEN },
        cache: 'no-store',
      });
      if (!service.ok) return Response.json({ error: 'Delivery service temporarily unavailable' }, { status: 503 });
      const check = await service.json();
      if (!Array.isArray(check.delivery_codes) || !check.delivery_codes.length) {
        return Response.json({ error: 'Delivery unavailable at this PIN code' }, { status: 400 });
      }
    } else if (shippingSimulationEnabled()) {
      shippingSimulation = true;
    } else {
      return Response.json({ error: 'Delivery service is not configured' }, { status: 503 });
    }

    await db();

    // Idempotency: a retried request (network retry / double click) returns the original order.
    const headerKey = req.headers.get('x-idempotency-key');
    const idempotencyKey = clean(headerKey || body.idempotencyKey, 120) || undefined;
    if (idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey }).lean() as any;
      if (existing) {
        return Response.json({
          orderId: String(existing._id),
          number: existing.number,
          razorpayOrderId: existing.razorpayOrderId,
          key: existing.simulation ? '' : process.env.RAZORPAY_KEY_ID || '',
          amount: Math.round(existing.total * 100),
          currency: 'INR',
          simulation: Boolean(existing.simulation),
          shippingSimulation: Boolean(existing.shipment?.simulated) || shippingSimulation,
        } satisfies CheckoutResponse);
      }
    }

    let subtotal = 0;
    const items: any[] = [];
    for (const item of body.items) {
      const p = await Product.findById(item.id);
      const qty = Number(item.qty);
      if (!p || !p.published) {
        return Response.json({ error: 'Item unavailable' }, { status: 409 });
      }
      subtotal += p.price * qty;
      items.push({
        productId: String(p._id),
        name: p.name,
        price: p.price,
        qty,
        image: p.images?.[0] || '',
      });
    }

    let couponDoc: any = null;
    if (body.coupon) {
      const code = clean(body.coupon, 50).toUpperCase();
      couponDoc = await Coupon.findOne({ code });
    }
    const pricing = calculatePricing(subtotal, couponDoc, freeShippingThreshold(), flatShippingFee());
    if ('error' in pricing) return Response.json({ error: pricing.error }, { status: 400 });

    const simulation = paymentSimulationEnabled();
    if (!razorpayConfigured() && !simulation) {
      return Response.json({ error: 'Payment gateway not configured' }, { status: 503 });
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
          name: clean(c.name, 120),
          email: clean(c.email, 200),
          phone: clean(c.phone, 20),
          address: clean(c.address, 500),
          city: clean(c.city, 120),
          state: clean(c.state, 120),
          pin: clean(c.pin, 10),
        },
        items,
        inventoryMode: 'unlimited',
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
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
        shippingSimulation,
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
            amount: Math.round(existing.total * 100),
            currency: 'INR',
            simulation: Boolean(existing.simulation),
            shippingSimulation,
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
