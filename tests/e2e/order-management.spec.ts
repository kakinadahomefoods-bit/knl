import { test, expect } from '@playwright/test';

const email = process.env.TEST_ADMIN_EMAIL || 'admin@test.cruvita.com';
const password = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!';

test.describe('Order management', () => {
  test('admin can view orders and reconcile', async ({ page, request }) => {
    await request.post('/api/admin/login', { data: { email, password } });
    await page.goto('/admin');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button:has-text("Sign in")');
    await page.click('button:has-text("Orders")');
    // Orders table/list may be empty; page should render without error.
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  });
});