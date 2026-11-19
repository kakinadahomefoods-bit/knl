import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidPin,
  computeParcel,
  parseRateCard,
  calculateFallbackRate,
  applyFreeShipping,
  normalizeTracking,
  DEFAULT_RATE_CARD,
  isPrepaidServiceable,
} from '../.test-build/shipping.js';

test('Delhivery PIN requires a matching prepaid-enabled non-embargoed postcode', () => {
  const record = (pin, pre_paid, remarks = '') => ({ delivery_codes: [{ postal_code: { pin, pre_paid, remarks } }] });
  assert.equal(isPrepaidServiceable(record(518502, 'Y'), '518502'), true);
  assert.equal(isPrepaidServiceable(record(518502, 'N'), '518502'), false);
  assert.equal(isPrepaidServiceable(record(518502, 'Y', 'Embargo'), '518502'), false);
  assert.equal(isPrepaidServiceable(record(518503, 'Y'), '518502'), false);
  assert.equal(isPrepaidServiceable({ delivery_codes: [{}] }, '518502'), false);
});

test('PIN validation accepts only six nonzero-starting digits', () => {
  assert.equal(isValidPin('518502'), true);
  assert.equal(isValidPin(' 518502 '), true);
  assert.equal(isValidPin('018502'), false);
  assert.equal(isValidPin('51850'), false);
  assert.equal(isValidPin('ABCDEFGH'), false);
  assert.equal(isValidPin(518502), false);
});

test('packed parcel uses total weight and derives dimensions from volume', () => {
  const parcel = computeParcel([
    { qty: 2, weightGrams: 300, lengthCm: 20, breadthCm: 15, heightCm: 10 },
  ]);
  assert.equal(parcel.items, 2);
  assert.equal(parcel.weightGrams, 600);
  assert.ok(parcel.lengthCm >= 10 && parcel.lengthCm <= 100);
  assert.ok(parcel.billableWeightGrams >= parcel.weightGrams);
});

test('volumetric weight can exceed actual weight', () => {
  const parcel = computeParcel([
    { qty: 1, weightGrams: 100, lengthCm: 100, breadthCm: 100, heightCm: 100 },
  ]);
  assert.ok(parcel.volumetricWeightGrams > parcel.weightGrams);
  assert.equal(parcel.billableWeightGrams, parcel.volumetricWeightGrams);
});

test('default parcel is returned for an empty cart', () => {
  const parcel = computeParcel([]);
  assert.equal(parcel.items, 0);
  assert.equal(parcel.weightGrams, 0);
  assert.ok(parcel.billableWeightGrams > 0);
});

test('rate card parses and merges with defaults; rejects invalid JSON', () => {
  assert.deepEqual(parseRateCard(undefined).card, DEFAULT_RATE_CARD);
  assert.equal(parseRateCard('{bad json').ok, false);
  const parsed = parseRateCard('{"defaultFee":120,"slabs":[{"upToGrams":300,"fee":55}]}');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.card.defaultFee, 120);
  assert.equal(parsed.card.slabs[0].fee, 55);
  assert.ok(parsed.card.slabs.length === DEFAULT_RATE_CARD.slabs.length);
});

test('fallback rate uses weight slabs and pickup PIN locality', () => {
  const local = calculateFallbackRate(DEFAULT_RATE_CARD, {
    pickupPin: '518502', destinationPin: '518001', billableWeightGrams: 500,
  });
  const distant = calculateFallbackRate(DEFAULT_RATE_CARD, {
    pickupPin: '518502', destinationPin: '110001', billableWeightGrams: 500,
  });
  assert.equal(local.local, true);
  assert.equal(distant.local, false);
  assert.ok(local.amount < distant.amount);
  assert.equal(distant.amount, 70);
});

test('configured PIN prefix multiplier overrides the local multiplier', () => {
  const card = { ...DEFAULT_RATE_CARD, pinPrefixMultipliers: [{ prefix: '11', multiplier: 2 }] };
  const rate = calculateFallbackRate(card, {
    pickupPin: '518502', destinationPin: '110001', billableWeightGrams: 500,
  });
  assert.equal(rate.multiplier, 2);
  assert.equal(rate.amount, 140);
});

test('free shipping threshold zeroes the charge only at or above the threshold', () => {
  assert.equal(applyFreeShipping(999, 80, 999), 0);
  assert.equal(applyFreeShipping(998, 80, 999), 80);
  assert.equal(applyFreeShipping(0, 80, 0), 80);
});

test('tracking normaliser extracts Delhivery status and timeline', () => {
  const result = normalizeTracking({
    ShipmentData: [{
      Shipment: {
        AWB: 'SIM123456789', Status: 'IN TRANSIT', StatusDescription: 'In transit',
        trackInfo: [{ 'Date/Time': '2026-01-01 10:00', Status: 'Picked up', Location: 'Nandyal' }],
      },
    }],
  });
  assert.equal(result.awb, 'SIM123456789');
  assert.equal(result.status, 'IN TRANSIT');
  assert.equal(result.timeline.length, 1);
  assert.equal(result.timeline[0].location, 'Nandyal');
});
