import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCustomer, validateCart, slugify, formatAddress } from '../.test-build/validation.js';

const good = {
  name: 'Asha Rao', phone: '9876543210', email: 'asha@example.com',
  houseNo: '12', street: 'Main Street', landmark: 'Near the temple',
  city: 'Kurnool', state: 'Andhra Pradesh', pin: '518001',
};

test('valid guest details pass validation', () => {
  assert.equal(validateCustomer(good), null);
});

test('invalid phone, email and PIN are rejected', () => {
  assert.match(validateCustomer({ ...good, phone: '123' }), /mobile number/i);
  assert.match(validateCustomer({ ...good, email: 'not-an-email' }), /email/i);
  assert.match(validateCustomer({ ...good, pin: '123' }), /PIN/i);
});

test('house number and street are required and landmark is optional', () => {
  assert.match(validateCustomer({ ...good, houseNo: '' }), /house\/flat/i);
  assert.equal(validateCustomer({ ...good, landmark: '' }), null);
});

test('legacy address-only customers still validate', () => {
  const { houseNo, street, landmark, ...legacy } = good;
  assert.equal(validateCustomer({ ...legacy, address: '12 Main Street' }), null);
});

test('formatAddress composes structured fields and preserves legacy input', () => {
  assert.equal(formatAddress(good), '12, Main Street, Landmark: Near the temple');
  assert.equal(formatAddress({ address: '12 Main Street' }), '12 Main Street');
});

test('cart rejects duplicate ids, bad quantities and empty carts', () => {
  const id = '507f1f77bcf86cd799439011';
  assert.equal(validateCart([{ id, qty: 2 }]), null);
  assert.match(validateCart([{ id, qty: 2 }, { id, qty: 1 }]), /Duplicate/);
  assert.match(validateCart([{ id, qty: 0 }]), /quantity/i);
  assert.match(validateCart([]), /cart/i);
});

test('slugify produces URL-safe slugs', () => {
  assert.equal(slugify('Classic Chocolate Chip!'), 'classic-chocolate-chip');
});
