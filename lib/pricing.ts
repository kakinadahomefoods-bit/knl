/** Pure pricing helpers — no database or framework imports, safe to unit test. */

export type CouponLike = {
  code?: string;
  type?: string;
  value?: number;
  minOrder?: number;
  maxDiscount?: number;
  usageLimit?: number;
  used?: number;
  expiresAt?: Date | string | null;
  enabled?: boolean;
};

export type PricingResult = {
  subtotal: number;
  discount: number;
  coupon: string;
  shipping: number;
  total: number;
};

export function couponError(coupon: CouponLike | null | undefined, subtotal: number, now = Date.now()): string | null {
  if (!coupon || coupon.enabled === false) return 'Coupon invalid or expired';
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return 'Coupon invalid or expired';
  if (coupon.minOrder && subtotal < coupon.minOrder) return 'Coupon invalid or expired';
  if (coupon.usageLimit && (coupon.used || 0) >= coupon.usageLimit) return 'Coupon invalid or expired';
  if (coupon.type !== 'percent' && coupon.type !== 'fixed') return 'Coupon invalid or expired';
  if (!Number.isFinite(Number(coupon.value)) || Number(coupon.value) <= 0) return 'Coupon invalid or expired';
  return null;
}

export function computeDiscount(coupon: CouponLike | null | undefined, subtotal: number): number {
  if (!coupon || couponError(coupon, subtotal)) return 0;
  const value = Number(coupon.value);
  const raw = coupon.type === 'percent' ? (subtotal * value) / 100 : value;
  const cap = coupon.maxDiscount && coupon.maxDiscount > 0 ? coupon.maxDiscount : Infinity;
  return Math.max(0, Math.round(Math.min(subtotal, raw, cap) * 100) / 100);
}

export function computeTotals(
  subtotal: number,
  discount: number,
  freeThreshold: number,
  flatFee: number
): { shipping: number; total: number } {
  const net = Math.max(0, subtotal - discount);
  const shipping = net >= freeThreshold ? 0 : flatFee;
  return { shipping, total: Math.max(0, Math.round((net + shipping) * 100) / 100) };
}

export function calculatePricing(
  subtotal: number,
  coupon: CouponLike | null | undefined,
  freeThreshold: number,
  flatFee: number,
  now = Date.now()
): PricingResult | { error: string } {
  const err = coupon ? couponError(coupon, subtotal, now) : null;
  if (err) return { error: err };
  const discount = computeDiscount(coupon, subtotal);
  const { shipping, total } = computeTotals(subtotal, discount, freeThreshold, flatFee);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount,
    coupon: (coupon?.code || '').toUpperCase(),
    shipping,
    total,
  };
}
