import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

test.describe('Razorpay payments', () => {
  test('payment verification rejects invalid signature', async ({ request }) => {
    const res = await request.post('/api/payments/verify', {
      data: { razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'bad' },
    });
    expect([400, 401, 404, 503]).toContain(res.status());
  });

  test('webhook rejects invalid signature', async ({ request }) => {
    const res = await request.post('/api/payments/webhook', {
      data: { event: 'payment.captured' },
      headers: { 'x-razorpay-signature': 'bad' },
    });
    expect([400, 401, 503]).toContain(res.status());
  });
});