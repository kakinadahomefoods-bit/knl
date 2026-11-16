import test from 'node:test';
import assert from 'node:assert/strict';
import { simulationPaymentId, simulationOrderId, simulationSignature, simulationAwb, simulationTrackingSteps } from '../.test-build/simulation.js';

test('simulated identifiers are unmistakably prefixed', () => {
  assert.match(simulationPaymentId('CC-1'), /^sim_pay_[a-f0-9]{20}$/);
  assert.match(simulationOrderId('CC-1'), /^sim_order_[a-f0-9]{20}$/);
  assert.match(simulationAwb(), /^SIM\d{9}$/);
});

test('simulation signature is deterministic for the same order and payment', () => {
  const a = simulationSignature('sim_order_1', 'sim_pay_1');
  const b = simulationSignature('sim_order_1', 'sim_pay_1');
  const c = simulationSignature('sim_order_1', 'sim_pay_2');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test('simulation tracking steps progress to delivered', () => {
  const steps = simulationTrackingSteps();
  assert.ok(steps.length >= 4);
  assert.match(steps.at(-1).status, /Delivered/);
});
