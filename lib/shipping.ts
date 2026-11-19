/**
 * Pure shipping domain helpers. No framework, database or network imports so this
 * module can be unit tested in isolation. Money is always rounded to 2 decimals.
 *
 * IMPORTANT: Delhivery's freight/rate API is account specific (it is listed in the
 * Delhivery One "Client Developer Portal" but has no fixed public endpoint). This
 * module therefore contains NO invented carrier endpoint. The configurable fallback
 * below is a business rule for this store only — it is NOT a Delhivery quote and is
 * inactive unless explicitly enabled with SHIPPING_RATE_FALLBACK=true.
 */

export type PackageItem = {
  qty: number;
  weightGrams?: number | null;
  lengthCm?: number | null;
  breadthCm?: number | null;
  heightCm?: number | null;
};

export type PackedParcel = {
  items: number;
  weightGrams: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  volumetricWeightGrams: number;
  billableWeightGrams: number;
  volumetricDivisor: number;
};

export type RateCard = {
  currency: 'INR';
  defaultFee: number;
  slabs: Array<{ upToGrams: number; fee: number }>;
  localPrefixLength: number;
  localMultiplier: number;
  pinPrefixMultipliers: Array<{ prefix: string; multiplier: number }>;
};

export type PackageDefaults = {
  weightGrams: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  volumetricDivisor: number;
  maxWeightGrams: number;
  maxSideCm: number;
};

export const DEFAULT_PACKAGE_DEFAULTS: PackageDefaults = {
  weightGrams: 250,
  lengthCm: 20,
  breadthCm: 15,
  heightCm: 10,
  volumetricDivisor: 5000,
  maxWeightGrams: 30000,
  maxSideCm: 100,
};

/** Conservative, editable example rate card — used only when the fallback is enabled. */
export const DEFAULT_RATE_CARD: RateCard = {
  currency: 'INR',
  defaultFee: 80,
  slabs: [
    { upToGrams: 500, fee: 70 },
    { upToGrams: 1000, fee: 90 },
    { upToGrams: 2000, fee: 120 },
    { upToGrams: 5000, fee: 180 },
    { upToGrams: 10000, fee: 260 },
    { upToGrams: 30000, fee: 380 },
  ],
  localPrefixLength: 2,
  localMultiplier: 0.85,
  pinPrefixMultipliers: [],
};

export function isValidPin(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{5}$/.test(value.trim()) && value.trim().length === 6;
}

export function normalizePin(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function roundMoney(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function positiveNumber(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.min(max, n);
}

/** Compute actual, volumetric and billable weight plus a single packed cuboid. */
export function computeParcel(items: PackageItem[], overrides: Partial<PackageDefaults> = {}): PackedParcel {
  const d = { ...DEFAULT_PACKAGE_DEFAULTS, ...overrides };
  let qtyTotal = 0;
  let actualGrams = 0;
  let volumeCc = 0;
  let maxLength = 0;
  let maxBaseArea = 0;

  for (const raw of Array.isArray(items) ? items : []) {
    const qty = Math.max(0, Math.floor(positiveNumber(raw?.qty, 0)));
    if (!qty) continue;
    const weight = positiveNumber(raw?.weightGrams, d.weightGrams, 0, d.maxWeightGrams);
    const length = positiveNumber(raw?.lengthCm, d.lengthCm, 1, d.maxSideCm);
    const breadth = positiveNumber(raw?.breadthCm, d.breadthCm, 1, d.maxSideCm);
    const height = positiveNumber(raw?.heightCm, d.heightCm, 1, d.maxSideCm);
    qtyTotal += qty;
    actualGrams += weight * qty;
    volumeCc += length * breadth * height * qty;
    maxLength = Math.max(maxLength, length);
    maxBaseArea = Math.max(maxBaseArea, length * breadth);
  }

  const totalWeight = Math.min(d.maxWeightGrams, Math.ceil(actualGrams));
  if (!qtyTotal) {
    const volume = d.lengthCm * d.breadthCm * d.heightCm;
    return {
      items: 0,
      weightGrams: totalWeight,
      lengthCm: d.lengthCm,
      breadthCm: d.breadthCm,
      heightCm: d.heightCm,
      volumetricWeightGrams: Math.ceil(volume / d.volumetricDivisor),
      billableWeightGrams: Math.max(totalWeight, Math.ceil(volume / d.volumetricDivisor)),
      volumetricDivisor: d.volumetricDivisor,
    };
  }

  const packedLength = Math.min(d.maxSideCm, Math.max(1, Math.ceil(maxLength || d.lengthCm)));
  const baseArea = Math.max(packedLength, Math.ceil(maxBaseArea || d.lengthCm * d.breadthCm));
  const packedBreadth = Math.min(d.maxSideCm, Math.max(1, Math.ceil(baseArea / packedLength)));
  const packedHeight = Math.min(d.maxSideCm, Math.max(1, Math.ceil(volumeCc / (packedLength * packedBreadth))));
  const volumetric = Math.ceil((packedLength * packedBreadth * packedHeight) / d.volumetricDivisor);

  return {
    items: qtyTotal,
    weightGrams: totalWeight,
    lengthCm: packedLength,
    breadthCm: packedBreadth,
    heightCm: packedHeight,
    volumetricWeightGrams: volumetric,
    billableWeightGrams: Math.max(totalWeight, Math.min(d.maxWeightGrams, volumetric)),
    volumetricDivisor: d.volumetricDivisor,
  };
}

/** Parse a JSON rate card from an env var, merging missing keys with defaults. */
export function parseRateCard(raw: string | undefined | null): { ok: true; card: RateCard } | { ok: false; error: string } {
  if (!raw || !raw.trim()) return { ok: true, card: DEFAULT_RATE_CARD };
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'SHIPPING_RATE_CARD is not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'SHIPPING_RATE_CARD must be a JSON object' };
  }
  const card: RateCard = {
    currency: 'INR',
    defaultFee: positiveNumber(parsed.defaultFee, DEFAULT_RATE_CARD.defaultFee, 0, 100000),
    slabs: DEFAULT_RATE_CARD.slabs.map((fallback, i) => {
      const candidate = Array.isArray(parsed.slabs) ? parsed.slabs[i] : undefined;
      return {
        upToGrams: positiveNumber(candidate?.upToGrams, fallback.upToGrams, 1, 1000000),
        fee: positiveNumber(candidate?.fee, fallback.fee, 0, 100000),
      };
    }),
    localPrefixLength: Math.min(6, Math.max(2, Math.floor(positiveNumber(parsed.localPrefixLength, 2, 2, 6)))),
    localMultiplier: positiveNumber(parsed.localMultiplier, DEFAULT_RATE_CARD.localMultiplier, 0.01, 10),
    pinPrefixMultipliers: Array.isArray(parsed.pinPrefixMultipliers)
      ? parsed.pinPrefixMultipliers
          .filter((z: any) => typeof z?.prefix === 'string' && /^\d{1,6}$/.test(z.prefix))
          .map((z: any) => ({ prefix: z.prefix, multiplier: positiveNumber(z.multiplier, 1, 0.01, 10) }))
      : [],
  };
  card.slabs.sort((a, b) => a.upToGrams - b.upToGrams);
  return { ok: true, card };
}

export type FallbackRate = {
  amount: number;
  baseFee: number;
  multiplier: number;
  slab: { upToGrams: number; fee: number } | null;
  local: boolean;
};

/** CONFIGURABLE BUSINESS FALLBACK — not a Delhivery rate quote. */
export function calculateFallbackRate(
  card: RateCard,
  input: { pickupPin: string; destinationPin: string; billableWeightGrams: number }
): FallbackRate {
  const weight = Math.max(0, Math.floor(positiveNumber(input.billableWeightGrams, 0)));
  const slab = card.slabs.find((s) => weight <= s.upToGrams) || null;
  const baseFee = slab ? slab.fee : card.defaultFee;
  const pickup = normalizePin(input.pickupPin);
  const destination = normalizePin(input.destinationPin);
  const local = Boolean(
    pickup && destination && pickup.length >= card.localPrefixLength &&
      destination.length >= card.localPrefixLength &&
      pickup.slice(0, card.localPrefixLength) === destination.slice(0, card.localPrefixLength)
  );
  let multiplier = local ? card.localMultiplier : 1;
  for (const zone of card.pinPrefixMultipliers) {
    if (destination.startsWith(zone.prefix)) multiplier = zone.multiplier;
  }
  return { amount: roundMoney(baseFee * multiplier), baseFee, multiplier, slab, local };
}

/** Free-shipping threshold is applied after any rate source is resolved. */
export function applyFreeShipping(netAmount: number, shippingAmount: number, threshold: number): number {
  const net = roundMoney(netAmount);
  if (threshold > 0 && net >= threshold) return 0;
  return roundMoney(shippingAmount);
}

export type TrackingEvent = { status: string; location: string; at: string };
export type NormalizedTracking = {
  awb: string;
  status: string;
  description: string;
  expected?: string;
  timeline: TrackingEvent[];
  raw: unknown;
};

/** Normalise Delhivery's documented tracking JSON into a small UI-friendly shape. */
export function normalizeTracking(data: unknown): NormalizedTracking {
  const root = data && typeof data === 'object' ? (data as any) : {};
  const shipment = Array.isArray(root.ShipmentData)
    ? root.ShipmentData.find((s: any) => s?.Shipment)?.Shipment
    : root.Shipment || undefined;
  const s = shipment && typeof shipment === 'object' ? shipment : {};
  const timeline: TrackingEvent[] = Array.isArray(s.trackInfo)
    ? s.trackInfo.map((point: any) => ({
        status: String(point?.Status || point?.status || 'Update').slice(0, 200),
        location: String(point?.Location || point?.location || '').slice(0, 200),
        at: String(point?.['Date/Time'] || point?.date || point?.at || '').slice(0, 80),
      }))
    : [];
  return {
    awb: String(s.AWB || s.awb || s.waybill || ''),
    status: String(s.Status || s.status || '').slice(0, 200),
    description: String(s.StatusDescription || s.Status || '').slice(0, 300),
    expected: s.ExpectedTime ? String(s.ExpectedTime).slice(0, 80) : undefined,
    timeline,
    raw: data,
  };
}
