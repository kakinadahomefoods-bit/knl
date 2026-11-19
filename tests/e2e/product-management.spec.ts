import { test, expect } from '@playwright/test';

const email = process.env.TEST_ADMIN_EMAIL || 'admin@test.cruvita.com';
const password = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!';

test.describe('Product management', () => {
  test('admin can create and publish a product', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button:has-text("Sign in")');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.click('button:has-text("Products")');
    await page.click('button:has-text("+ Add Product")');
    const name = 'E2E Test Cookie ' + Date.now();
    await page.fill('label:has-text("name") input', name);
    await page.fill('label:has-text("slug") input', name.toLowerCase().replace(/\s+/g, '-'));
    await page.fill('label:has-text("category") input', 'Cookies');
    await page.fill('label:has-text("price") input', '199');
    await page.fill('label:has-text("stock") input', '10');
    await page.check('input[type=checkbox]');
    await page.click('button:has-text("Save Product")');
    await expect(page.getByText('Product saved')).toBeVisible();

    await page.goto('/');
    await page.click('button:has-text("Shop All")');
    await expect(page.getByText(name)).toBeVisible();
  });
});