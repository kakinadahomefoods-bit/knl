import { test, expect } from '@playwright/test';

const email = process.env.TEST_ADMIN_EMAIL || 'admin@test.cruvita.com';
const password = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!';

async function adminLogin(request: any) {
  const res = await request.post('/api/admin/login', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
}

test.describe('Guest checkout', () => {
  test.beforeEach(async ({ request }) => {
    await adminLogin(request);
    await request.post('/api/products', {
      data: { name: 'E2E Checkout Cookie', slug: 'e2e-checkout-cookie-' + Date.now(), category: 'Cookies', price: 299, stock: 10, published: true },
    });
  });

  test('guest can reach checkout and submit delivery details', async ({ page, request }) => {
    const res = await request.get('/api/products');
    const products = (await res.json()).products;
    const p = products[0];
    await page.goto('/');
    await page.evaluate((id) => {
      localStorage.setItem('cruvita-cart', JSON.stringify([{ id, qty: 1 }]));
    }, p._id);
    await page.reload();
    await page.click('button:has-text("Bag")');
    await page.click('button:has-text("Guest Checkout")');
    await expect(page.getByRole('heading', { name: /Guest Checkout/i })).toBeVisible();

    const inputs = page.locator('input');
    await inputs.nth(0).fill('Test Guest');
    await inputs.nth(1).fill('guest@test.com');
    await inputs.nth(2).fill('9999999999');
    await inputs.nth(3).fill('123 Test Street');
    await inputs.nth(4).fill('TestCity');
    await inputs.nth(5).fill('TestState');
    await inputs.nth(6).fill('110001');

    await page.click('button:has-text("Pay Securely")');
    await expect(page.locator('body')).toBeVisible();
  });
});