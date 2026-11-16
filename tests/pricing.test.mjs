import test from 'node:test';
import assert from 'node:assert/strict';
import { couponError, computeDiscount, computeTotals, calculatePricing } from '../.test-build/pricing.js';

test('percent coupon honours maxDiscount cap', () => {
  const coupon = { code: 'SAVE10', type: 'percent', value: 10, maxDiscount: 50, enabled: true };
  assert.equal(computeDiscount(coupon, 1000), 50);
  assert.equal(computeDiscount(coupon, 300), 30);
});

test('fixed coupon cannot exceed subtotal', () => {
  assert.equal(computeDiscount({ type: 'fixed', value: 500, enabled: true }, 200), 200);
});

test('expired and exhausted coupons are rejected', () => {
  assert.ok(couponError({ type: 'fixed', value: 10, expiresAt: '2020-01-01', enabled: true }, 500));
  assert.ok(couponError({ type: 'fixed', value: 10, usageLimit: 2, used: 2, enabled: true }, 500));
  assert.equal(couponError({ type: 'fixed', value: 10, enabled: true }, 500), null);
});

test('shipping is free at or above the threshold', () => {
  assert.deepEqual(computeTotals(999, 0, 999, 80), { shipping: 0, total: 999 });
  assert.deepEqual(computeTotals(998, 0, 999, 80), { shipping: 80, total: 1078 });
});

test('calculatePricing returns an error object for an invalid coupon', () => {
  const result = calculatePricing(500, { code: 'BAD', type: 'percent', value: 10, minOrder: 1000, enabled: true }, 999, 80);
  assert.equal(result.error, 'Coupon invalid or expired');
});
