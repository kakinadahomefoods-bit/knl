import { db } from './db';
import { Content, Coupon, Order, Product } from './models';
import {
  createShipment,
  createSimulatedShipment,
  delhiveryConfigured as delhiveryTokenConfigured,
  serviceability as delhiveryServiceability,
} from './delhivery';
import {
  defaultFallbackShippingMethod,
  delhiveryEnabled,
  delhiveryRateApiEnabled,
  flatShippingFee,
  shippingRateFallbackEnabled,
  shippingSimulationEnabled,
  type FallbackShippingMethod,
} from './config';
import { computeDiscount, couponError } from './pricing';
import { notifyOrder, shipmentEmail } from './email';
import {
  resolveShippingMode as resolveMode,
  type CheckoutErrorCode,
  type ResolvedShipping,
  type ShippingMode,
} from './shipping-mode';

export type { ShippingMode, ResolvedShipping, CheckoutErrorCode } from './shipping-mode';
import {
  applyFreeShipping,
  calculateFallbackRate,
  computeParcel,
  isValidPin,
  normalizePin,
  parseRateCard,
  roundMoney,
  type PackageItem,
  type PackedParcel,
  DEFAULT_PACKAGE_DEFAULTS,
} from './shipping';

export const runtime = 'nodejs';

const REQUEST_TIMEOUT_MS = 10000;

type StoreSettings = {
  freeShippingThreshold: number;
  flatShippingFee: number;
  pickupPin: string;
  pickupName: string;
  delhiveryEnabled: boolean;
  fallbackShippingMethod: FallbackShippingMethod;
  packageDefaults: typeof DEFAULT_PACKAGE_DEFAULTS;
};

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  return fallback;
}

function parseFallbackMethod(value: unknown): FallbackShippingMethod {
  return value === 'none' || value === 'rate_card' || value === 'flat_fee'
    ? value
    : defaultFallbackShippingMethod();
}

/** Adapt admin/environment settings to the pure shipping-mode decision. */
export function resolveShippingMode(settings: StoreSettings): ResolvedShipping {
  return resolveMode({
    delhiveryEnabled: settings.delhiveryEnabled,
    delhiveryTokenConfigured: delhiveryTokenConfigured(),
    shippingSimulationAllowed: shippingSimulationEnabled(),
    fallbackShippingMethod: settings.fallbackShippingMethod,
    delhiveryRateApiEnabled: delhiveryRateApiEnabled(),
  });
}

function numericEnv(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export async function getShippingSettings(): Promise<StoreSettings> {
  await db();
  const doc = await Content.findOne({ key: 'settings' }).lean() as any;
  const s = doc?.value && typeof doc.value === 'object' ? doc.value : {};
  const settingNumber = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    // Admin "Settings" values are authoritative; env vars are the fallback.
    freeShippingThreshold: 1500,
    flatShippingFee: settingNumber(s.flatShippingFee, flatShippingFee()),
    pickupPin: normalizePin(process.env.DELHIVERY_PICKUP_PIN || s.pickupPin || '').slice(0, 6),
    pickupName: String(process.env.DELHIVERY_PICKUP_NAME || s.pickupName || '').trim().slice(0, 120),
    delhiveryEnabled: parseBoolean(s.delhiveryEnabled, delhiveryEnabled()),
    fallbackShippingMethod: parseFallbackMethod(s.fallbackShippingMethod),
    packageDefaults: {
      ...DEFAULT_PACKAGE_DEFAULTS,
      weightGrams: numericEnv('SHIPPING_DEFAULT_WEIGHT_GRAMS', DEFAULT_PACKAGE_DEFAULTS.weightGrams, 1, 30000),
      lengthCm: numericEnv('SHIPPING_DEFAULT_LENGTH_CM', DEFAULT_PACKAGE_DEFAULTS.lengthCm, 1, 100),
      breadthCm: numericEnv('SHIPPING_DEFAULT_BREADTH_CM', DEFAULT_PACKAGE_DEFAULTS.breadthCm, 1, 100),
      heightCm: numericEnv('SHIPPING_DEFAULT_HEIGHT_CM', DEFAULT_PACKAGE_DEFAULTS.heightCm, 1, 100),
      volumetricDivisor: numericEnv('SHIPPING_VOLUMETRIC_DIVISOR', DEFAULT_PACKAGE_DEFAULTS.volumetricDivisor, 1, 100000),
    },
  };
}

export type ServiceabilityResult = {
  serviceable: boolean;
  configured: boolean;
  simulated: boolean;
  mode: ShippingMode;
  details?: unknown;
  city?: string;
  state?: string;
  note?: string;
  error?: string;
  errorCode?: ResolvedShipping['errorCode'];
};

const MANUAL_NOTE = 'Delivery will be arranged by our team. No automatic courier booking is made.';

/**
 * PIN serviceability. Delhivery is called only when it is both enabled in admin
 * settings and reachable on the server. Otherwise an explicitly approved manual
 * method is used, or checkout is blocked with a customer-friendly message.
 */
export async function checkPinServiceability(
  pin: unknown,
  settings?: StoreSettings
): Promise<ServiceabilityResult> {
  const resolved = settings ? resolveShippingMode(settings) : resolveShippingMode(await getShippingSettings());
  const code = normalizePin(pin);
  if (!isValidPin(code)) {
    return {
      serviceable: false, configured: resolved.delhiveryLive, simulated: false, mode: resolved.mode,
      error: 'Enter a valid six-digit PIN code', errorCode: 'PIN_INVALID',
    };
  }

  if (resolved.mode === 'delhivery') {
    try {
      const result: any = await delhiveryServiceability(code);
      if (!result.configured) throw new Error('Carrier credentials unavailable');
      const first = Array.isArray(result.details?.delivery_codes)
        ? result.details.delivery_codes[0]?.postal_code || {}
        : {};
      if (!result.serviceable) {
        return {
          serviceable: false, configured: true, simulated: false, mode: 'delhivery',
          details: result.details,
          city: first.city ? String(first.city) : undefined,
          state: first.state ? String(first.state) : undefined,
          error: 'Delivery is not currently available at this PIN code.', errorCode: 'SHIPPING_UNAVAILABLE',
        };
      }
      return {
        serviceable: true, configured: true, simulated: false, mode: 'delhivery',
        details: result.details,
        city: first.city ? String(first.city) : undefined,
        state: first.state ? String(first.state) : undefined,
        note: 'Delivery availability checked with our courier partner.',
      };
    } catch {
      // A carrier outage must not block an otherwise approved manual method.
      const s = settings || await getShippingSettings();
      if (s.fallbackShippingMethod !== 'none') {
        return { serviceable: true, configured: false, simulated: false, mode: 'manual', note: MANUAL_NOTE };
      }
      return {
        serviceable: false, configured: true, simulated: false, mode: 'delhivery',
        error: 'Delivery cannot be arranged right now. Please try again shortly.',
        errorCode: 'SHIPPING_UNAVAILABLE',
      };
    }
  }

  if (resolved.mode === 'simulation') {
    return { serviceable: true, configured: false, simulated: true, mode: 'simulation', details: { simulation: true } };
  }
  if (resolved.mode === 'manual') {
    return { serviceable: true, configured: false, simulated: false, mode: 'manual', details: { manual: true }, note: MANUAL_NOTE };
  }
  return {
    serviceable: false, configured: false, simulated: false, mode: 'unconfigured',
    error: resolved.friendlyError, errorCode: resolved.errorCode,
  };
}

export type ShippingQuote = {
  amount: number;
  baseAmount: number;
  currency: 'INR';
  source: 'delhivery_rate_api' | 'fallback_rate_card' | 'flat_fee' | 'free_shipping' | 'simulation';
  /** Set on the order so manual shipments never trigger carrier AWB creation. */
  method: ShippingMode;
  simulated: boolean;
  serviceable: boolean;
  pickupPin: string;
  destinationPin: string;
  parcel: PackedParcel;
  freeShippingApplied: boolean;
  note: string;
  serviceability: ServiceabilityResult;
};

export type QuoteResult = {
  ok: boolean;
  status: number;
  error?: string;
  errorCode?: CheckoutErrorCode;
  quote?: ShippingQuote;
  serviceable?: boolean;
  pricing?: {
    subtotal: number;
    discount: number;
    coupon: string;
    shipping: number;
    total: number;
    items: Array<{ productId: string; name: string; price: number; qty: number; image: string; weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number }>;
  };
};

type QuoteInput = {
  pin: unknown;
  items?: Array<{ id?: unknown; qty?: unknown }> | null;
  coupon?: unknown;
  /** Skip all catalogue/discount work (used by the product-page PIN checker). */
  pinOnly?: boolean;
};

/** Single authoritative quote path used by both the checkout and the quote API. */
export async function quoteForCart(input: QuoteInput): Promise<QuoteResult> {
  const settings = await getShippingSettings();
  const resolved = resolveShippingMode(settings);
  const destinationPin = normalizePin(input.pin);
  if (!isValidPin(destinationPin)) {
    return { ok: false, status: 400, error: 'Enter a valid six-digit PIN code', errorCode: 'PIN_INVALID', serviceable: false };
  }

  const items = Array.isArray(input.items) ? input.items : [];
  let pricedItems: NonNullable<QuoteResult['pricing']>['items'] = [];
    let subtotal = 0;
  let discount = 0;
  let couponCode = '';

  if (!input.pinOnly) {
    if (!items.length) return { ok: false, status: 400, error: 'Your bag is empty', errorCode: 'CART_INVALID', serviceable: false };
    if (items.length > 40) return { ok: false, status: 400, error: 'Invalid cart', errorCode: 'CART_INVALID', serviceable: false };

    const seen = new Set<string>();
    const ids: string[] = [];
    for (const item of items) {
      const id = typeof item?.id === 'string' ? item.id : '';
      const qty = Number(item?.qty);
      if (!/^[a-f\d]{24}$/i.test(id) || !Number.isInteger(qty) || qty < 1 || qty > 20 || seen.has(id)) {
        return { ok: false, status: 400, error: 'Invalid cart', errorCode: 'CART_INVALID', serviceable: false };
      }
      seen.add(id);
      ids.push(id);
    }

    const products = await Product.find({ _id: { $in: ids } }).lean() as any[];
    const byId = new Map(products.map((p) => [String(p._id), p]));
    for (const id of ids) {
      const p = byId.get(id);
      const qty = Number(items.find((i) => String(i.id) === id)?.qty);
      if (!p || !p.published) return { ok: false, status: 409, error: 'An item in your bag is no longer available', serviceable: false };
      subtotal += Math.round(Number(p.price) * 100) * qty;
      pricedItems.push({
        productId: id,
        name: String(p.name),
        price: Number(p.price),
        qty,
        image: String(p.images?.[0] || ''),
        weightGrams: Number(p.weightGrams) || settings.packageDefaults.weightGrams,
        lengthCm: Number(p.lengthCm) || settings.packageDefaults.lengthCm,
        breadthCm: Number(p.breadthCm) || settings.packageDefaults.breadthCm,
        heightCm: Number(p.heightCm) || settings.packageDefaults.heightCm,
      });
    }

    subtotal /= 100;
    if (typeof input.coupon === 'string' && input.coupon.trim()) {
      couponCode = input.coupon.trim().toUpperCase().slice(0, 50);
      const coupon: any = await Coupon.findOne({ code: couponCode }).lean();
      if (couponError(coupon, subtotal)) {
        return { ok: false, status: 400, error: 'This coupon is invalid, expired or not eligible for your order.', errorCode: 'COUPON_INVALID', serviceable: false };
      }
      discount = computeDiscount(coupon, subtotal);
    }
  }

  const net = Math.max(0, roundMoney(subtotal - discount));
  const parcel = computeParcel(
    pricedItems.map((i) => ({ qty: i.qty, weightGrams: i.weightGrams, lengthCm: i.lengthCm, breadthCm: i.breadthCm, heightCm: i.heightCm })),
    settings.packageDefaults
  );

  const service = await checkPinServiceability(destinationPin, settings);
  if (!service.serviceable) {
    return {
      ok: false,
      status: service.errorCode === 'PIN_INVALID' || service.errorCode === 'SHIPPING_UNAVAILABLE' ? 400 : 503,
      error: service.error || 'Delivery is currently unavailable. Please contact the store.',
      errorCode: service.errorCode,
      serviceable: false,
    };
  }

  let amount = settings.flatShippingFee;
  let baseAmount = settings.flatShippingFee;
  let source: ShippingQuote['source'] = 'flat_fee';
  let note = service.note || 'Flat delivery charge. Free above the store threshold.';

  if (resolved.mode === 'simulation') {
    // Development-only. Never invent a real delivery price: the simulated order
    // carries zero shipping and is clearly labelled as a simulation everywhere.
    amount = 0;
    baseAmount = 0;
    source = 'simulation';
    note = 'Development simulation — no live carrier quote or charge.';
  } else if (resolved.mode === 'delhivery' && delhiveryRateApiEnabled()) {
    // The live freight API is account-specific and documented only inside the client
    // developer portal. Never guess a URL: fail explicitly until the account details
    // (endpoint + request/response schema) are supplied and wired.
    return {
      ok: false,
      status: 503,
      serviceable: true,
      errorCode: 'RATE_API_NOT_CONFIGURED',
      error: 'Live carrier rate calculation is not configured for this account. Contact the store owner.',
    };
  } else if (settings.fallbackShippingMethod === 'none') {
    return { ok: false, status: 503, serviceable: true, error: 'Unable to calculate delivery right now. Please try again.' };
  } else if (resolved.rateSource === 'rate_card' && (shippingRateFallbackEnabled() || resolved.mode === 'manual')) {
    if (!process.env.SHIPPING_RATE_CARD?.trim()) return { ok: false, status: 503, serviceable: true, error: 'Delivery rate card is not configured.' };
    const parsed = parseRateCard(process.env.SHIPPING_RATE_CARD);
    if (!parsed.ok || !isValidPin(settings.pickupPin)) return { ok: false, status: 503, serviceable: true, error: 'Unable to calculate delivery right now. Please try again.' };
    const rate = calculateFallbackRate(parsed.card, {
      pickupPin: settings.pickupPin,
      destinationPin,
      billableWeightGrams: parcel.billableWeightGrams,
    });
    amount = rate.amount;
    baseAmount = rate.amount;
    source = 'fallback_rate_card';
    note = 'Delivery charge based on packed weight and PIN. Arranged by our team, not a carrier quote.';
  } else if (resolved.rateSource === 'rate_card') {
    return { ok: false, status: 503, serviceable: true, error: 'Delivery rate card is not enabled.' };
  } else if (!Number.isFinite(amount)) {
    // No configured fee means no invented charge: block until the admin sets one.
    return {
      ok: false,
      status: 503,
      serviceable: true,
      errorCode: 'SHIPPING_NOT_CONFIGURED',
      error: 'Delivery charges have not been configured yet. Please contact the store.',
    };
  }

  const shipping = applyFreeShipping(net, amount, settings.freeShippingThreshold);
  const freeShippingApplied = settings.freeShippingThreshold > 0 && net > settings.freeShippingThreshold;
  if (freeShippingApplied) {
    source = 'free_shipping';
    note = `Free delivery applied on orders above ₹${settings.freeShippingThreshold}.`;
  } else if (service.simulated) {
    source = 'simulation';
    note = 'Development simulation — no live carrier quote or charge.';
  }

  const quote: ShippingQuote = {
    amount: shipping,
    baseAmount: roundMoney(baseAmount),
    currency: 'INR',
    source,
    method: service.mode,
    simulated: service.simulated,
    serviceable: true,
    pickupPin: settings.pickupPin,
    destinationPin,
    parcel,
    freeShippingApplied,
    note,
    serviceability: service,
  };

  const result: QuoteResult = {
    ok: true,
    status: 200,
    serviceable: true,
    quote,
  };
  if (!input.pinOnly) {
    result.pricing = {
      subtotal: roundMoney(subtotal),
      discount: roundMoney(discount),
      coupon: couponCode,
      shipping,
      total: roundMoney(net + shipping),
      items: pricedItems,
    };
  }
  return result;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  return message.replace(/https?:\/\/\S+/g, '[redacted]').slice(0, 300);
}

export type ShipmentResult = {
  ok: boolean;
  status: number;
  awb?: string;
  simulated?: boolean;
  alreadyCreated?: boolean;
  /** True when the order uses the approved manual method: no carrier call must be made. */
  manual?: boolean;
  error?: string;
  provider?: unknown;
};

/**
 * Idempotent shipment creation. An atomic claim on the order prevents two
 * concurrent requests (payment webhook + verification, or double-click) from
 * producing two AWBs. A sparse unique index on shipment.awb is a second guard.
 */
export async function createShipmentForOrder(
  orderId: string,
  options: { retry?: boolean } = {}
): Promise<ShipmentResult> {
  await db();
  // Manual/fallback orders are deliberately fulfilled by the store. Never call
  // the carrier for them, even if credentials later become available.
  const preflight: any = await Order.findById(orderId).lean();
  if (preflight?.shippingMethod === 'manual') {
    return { ok: false, status: 409, manual: true, error: 'Manual shipping method — no carrier shipment to create' };
  }

  const claimFilter: Record<string, unknown> = {
    _id: orderId,
    paymentStatus: 'paid',
    'shipment.creationState': { $ne: 'creating' },
    $or: [
      { 'shipment.awb': { $exists: false } },
      { 'shipment.awb': '' },
      { 'shipment.awb': { $exists: true, $eq: null } },
    ],
  };
  if (!options.retry) claimFilter['shipment.error'] = { $exists: false };

  let order: any;
  try {
    order = await Order.findOneAndUpdate(
      claimFilter,
      {
        $set: { 'shipment.creationState': 'creating', 'shipment.lastAttemptAt': new Date() },
        $unset: { 'shipment.error': '' },
        $inc: { 'shipment.attempts': 1 },
      },
      { new: true }
    ).lean();
  } catch {
    return { ok: false, status: 500, error: 'Unable to start shipment creation' };
  }

  if (!order) {
    const existing: any = await Order.findById(orderId).lean();
    if (!existing) return { ok: false, status: 404, error: 'Order not found' };
    if (existing.paymentStatus !== 'paid') return { ok: false, status: 400, error: 'Only paid orders can be shipped' };
    if (existing.shipment?.awb) {
      return { ok: false, status: 409, alreadyCreated: true, awb: existing.shipment.awb, error: 'Shipment already exists for this order' };
    }
    if (existing.shipment?.creationState === 'creating') {
      return { ok: false, status: 409, error: 'Shipment creation is already in progress' };
    }
    return { ok: false, status: 409, error: 'Shipment cannot be created for this order' };
  }

  const settings = await getShippingSettings();
  const storedParcel = order.shippingQuote?.parcel;
  let parcel: PackedParcel;
  if (storedParcel && Number(storedParcel.billableWeightGrams) > 0) {
    parcel = storedParcel as PackedParcel;
  } else {
    const products = await Product.find({ _id: { $in: order.items.map((i: any) => i.productId) } }).lean() as any[];
    const byId = new Map(products.map((p) => [String(p._id), p]));
    parcel = computeParcel(
      order.items.map((i: any) => {
        const p = byId.get(String(i.productId));
        return {
          qty: Number(i.qty) || 1,
          weightGrams: p?.weightGrams,
          lengthCm: p?.lengthCm,
          breadthCm: p?.breadthCm,
          heightCm: p?.heightCm,
        };
      }),
      settings.packageDefaults
    );
  }

  const meta = {
    weight: parcel.weightGrams,
    length: parcel.lengthCm,
    breadth: parcel.breadthCm,
    height: parcel.heightCm,
  };

  let result: any;
  try {
    if (!order.simulation && delhiveryTokenConfigured()) {
      result = await Promise.race([
        createShipment(order, meta),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Carrier request timed out')), REQUEST_TIMEOUT_MS)),
      ]);
    } else if (shippingSimulationEnabled()) {
      result = createSimulatedShipment();
    } else {
      throw new Error('Delhivery is not configured and simulation is disabled');
    }
  } catch (error) {
    const detail = safeErrorMessage(error);
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          'shipment.creationState': 'failed',
          'shipment.error': detail,
          'shipment.lastAttemptAt': new Date(),
          fulfillmentStatus: 'shipment_failed',
        },
      }
    );
    return { ok: false, status: 502, error: `Shipment creation failed: ${detail}` };
  }

  if (!result?.ok || !result?.awb) {
    const detail = safeErrorMessage(result?.error || 'Carrier did not return an AWB');
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          'shipment.creationState': 'failed',
          'shipment.error': detail,
          'shipment.lastAttemptAt': new Date(),
          fulfillmentStatus: 'shipment_failed',
        },
        ...(result?.details ? { 'shipment.providerPayload': result.details } : {}),
      }
    );
    return { ok: false, status: 502, error: `Shipment creation failed: ${detail}`, provider: result?.details };
  }

  const simulated = Boolean(result.simulated);
  try {
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          'shipment.awb': result.awb,
          'shipment.status': simulated ? 'created (simulated)' : 'created',
          'shipment.reference': order.number,
          'shipment.labelUrl': result.provider?.label_url || result.provider?.label || '',
          'shipment.simulated': simulated,
          'shipment.providerPayload': result.provider || {},
          'shipment.creationState': 'created',
          'shipment.lastAttemptAt': new Date(),
          'shipment.updates': [
            {
              status: simulated ? 'Shipment created (simulated)' : 'Shipment created',
              location: settings.pickupName || 'Cruvita Cookies studio',
              at: new Date(),
            },
          ],
          fulfillmentStatus: simulated ? 'shipment_created_simulated' : 'shipment_created',
        },
        $unset: { 'shipment.error': '' },
      }
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      return { ok: false, status: 409, alreadyCreated: true, error: 'A shipment with this AWB already exists' };
    }
    throw error;
  }

  if (order.customer?.email) {
    try {
      const fresh: any = await Order.findById(orderId).lean();
      const { subject, html, text } = shipmentEmail(fresh, result.awb, simulated);
      await notifyOrder(order._id, 'shipping', { to: order.customer.email, subject, html, text });
    } catch (error) {
      console.error('[shipping] notification failed:', (error as Error).message);
    }
  }

  return { ok: true, status: 200, awb: result.awb, simulated, provider: result.provider };
}

export type LabelResult = {
  ok: boolean;
  status: number;
  contentType?: string;
  body?: string;
  fileName?: string;
  redirect?: string;
  error?: string;
};

/** Admin label retrieval: stored URL, account-specific label API, or printable simulation. */
export async function getShipmentLabel(orderId: string): Promise<LabelResult> {
  await db();
  const order: any = await Order.findById(orderId).lean();
  if (!order) return { ok: false, status: 404, error: 'Order not found' };
  if (!order.shipment?.awb) return { ok: false, status: 404, error: 'No shipment to print' };
  const awb = String(order.shipment.awb);
  const fileName = `cruvita-label-${awb}.pdf`;

  const stored = String(order.shipment.labelUrl || '').trim();
  const labelApi = String(process.env.DELHIVERY_LABEL_API_URL || '').trim();
  const target = labelApi.replace('{awb}', encodeURIComponent(awb)) || stored;

  if (target && /^https?:\/\//i.test(target)) {
    if (!delhiveryTokenConfigured()) return { ok: false, status: 503, error: 'Delhivery is not configured' };
    try {
      const url = new URL(target);
      const carrier = new URL(process.env.DELHIVERY_API_BASE_URL || 'https://track.delhivery.com');
      if (url.protocol !== 'https:' || url.origin !== carrier.origin || url.username || url.password) {
        return { ok: false, status: 400, error: 'Untrusted carrier label URL' };
      }
      const response = await fetch(target, {
        headers: { Authorization: 'Token ' + process.env.DELHIVERY_API_TOKEN },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) return { ok: false, status: 502, error: 'Carrier label service returned an error' };
      const bytes = Buffer.from(await response.arrayBuffer());
      return { ok: true, status: 200, contentType: 'application/pdf', body: bytes.toString('base64'), fileName };
    } catch {
      return { ok: false, status: 502, error: 'Unable to download the carrier label right now' };
    }
  }

  if (target && target.startsWith('/')) return { ok: true, status: 200, redirect: target };

  if (order.shipment.simulated || shippingSimulationEnabled()) {
    const c = order.customer || {};
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Shipping label ${esc(awb)}</title>
<style>body{font-family:system-ui,Arial,sans-serif;margin:32px;color:#222}.label{border:2px solid #222;padding:24px;max-width:520px}h1{margin:0 0 4px}small{color:#777}.row{margin-top:12px}.bar{font-family:monospace;font-size:26px;letter-spacing:2px;margin-top:24px}.sim{color:#a54c40;font-weight:bold}</style></head><body>
<div class="label"><h1>Cruvita Cookies</h1><small>SHIPPING LABEL — DEVELOPMENT SIMULATION</small>
<p class="sim">SIMULATED — no parcel was handed to Delhivery.</p>
<div class="row"><strong>AWB:</strong> ${esc(awb)}</div><div class="row"><strong>Order:</strong> ${esc(order.number)}</div>
<div class="row"><strong>To:</strong> ${esc(c.name)}<br>${esc(c.address)}<br>${esc(c.city)}, ${esc(c.state)} ${esc(c.pin)}<br>${esc(c.phone)}</div>
<div class="row"><strong>Package:</strong> ${esc(order.shippingQuote?.parcel?.weightGrams || '—')} g</div>
<div class="bar">${esc(awb)}</div></div></body></html>`;
    return {
      ok: true,
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
      fileName: `cruvita-label-${awb}.html`,
    };
  }

  return {
    ok: false,
    status: 501,
    error: 'No label URL was returned and DELHIVERY_LABEL_API_URL is not configured. Use the Delhivery dashboard to print this label.',
  };
}
