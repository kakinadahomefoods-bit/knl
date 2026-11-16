import { test, expect } from '@playwright/test';

test.describe('Shipping', () => {
  test('serviceability endpoint validates PIN', async ({ request }) => {
    const res = await request.get('/api/shipping/serviceability?pin=110001');
    // Either configured (200) or not configured (503) depending on env.
    expect([200, 503]).toContain(res.status());
  });

  test('track endpoint requires secure token', async ({ request }) => {
    const res = await request.get('/api/track?number=CC-1&token=short');
    expect(res.status()).toBe(400);
  });
});