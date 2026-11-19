import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShippingMode } from '../.test-build/shipping-mode.js';

const base = {
  delhiveryEnabled: false,
  delhiveryTokenConfigured: false,
  shippingSimulationAllowed: false, // production-like
  fallbackShippingMethod: 'flat_fee',
  delhiveryRateApiEnabled: false,
};

test('Delhivery is used only when enabled AND the server has a token', () => {
  assert.equal(resolveShippingMode({ ...base, delhiveryTokenConfigured: true }).mode, 'manual');
  assert.equal(resolveShippingMode({ ...base, delhiveryEnabled: true }).mode, 'manual');
  const live = resolveShippingMode({ ...base, delhiveryEnabled: true, delhiveryTokenConfigured: true });
  assert.equal(live.mode, 'delhivery');
  assert.equal(live.delhiveryLive, true);
});

test('approved fallback allows manual checkout with a known rate source', () => {
  const flat = resolveShippingMode(base);
  assert.equal(flat.mode, 'manual');
  assert.equal(flat.rateSource, 'flat_fee');
  const card = resolveShippingMode({ ...base, fallbackShippingMethod: 'rate_card' });
  assert.equal(card.mode, 'manual');
  assert.equal(card.rateSource, 'rate_card');
});

test('no configured method blocks checkout with a customer-friendly message', () => {
  const blocked = resolveShippingMode({ ...base, fallbackShippingMethod: 'none' });
  assert.equal(blocked.mode, 'unconfigured');
  assert.equal(blocked.errorCode, 'SHIPPING_NOT_CONFIGURED');
  assert.match(blocked.friendlyError, /contact the store/i);
});

test('development simulation is separate and never used in production', () => {
  const sim = resolveShippingMode({ ...base, shippingSimulationAllowed: true, fallbackShippingMethod: 'none' });
  assert.equal(sim.mode, 'simulation');
  assert.equal(sim.delhiveryLive, false);
});

test('live rate API is flagged only for live Delhivery mode', () => {
  const live = resolveShippingMode({ ...base, delhiveryEnabled: true, delhiveryTokenConfigured: true, delhiveryRateApiEnabled: true });
  assert.equal(live.rateSource, 'delhivery_rate_api');
  const manual = resolveShippingMode({ ...base, delhiveryRateApiEnabled: true });
  assert.equal(manual.rateSource, 'flat_fee');
});
