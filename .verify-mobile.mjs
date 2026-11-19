import { chromium } from '@playwright/test';

const base = 'http://localhost:3011';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();

await page.goto(base + '/');
const products = await (await page.request.get(base + '/api/products')).json();
const id = products.products[0]._id;
await page.evaluate((id) => localStorage.setItem('cruvita-cart', JSON.stringify([{ id, qty: 1 }])), id);
await page.goto(base + '/checkout');
await page.getByRole('heading', { name: /Guest Checkout/i }).waitFor();
await page.getByRole('textbox', { name: 'Full name' }).fill('Mobile Tester');
await page.getByRole('textbox', { name: 'Phone number' }).fill('9876543210');
await page.getByRole('textbox', { name: 'Email address' }).fill('mobile@example.com');
await page.getByRole('textbox', { name: 'House/flat number' }).fill('42');
await page.getByRole('textbox', { name: 'Street and area' }).fill('Market Road');
await page.getByRole('textbox', { name: 'City' }).fill('Kurnool');
await page.getByRole('textbox', { name: 'State' }).fill('Andhra Pradesh');
await page.getByRole('textbox', { name: 'PIN code Check' }).fill('518001');
await page.getByText('Final payable amount').waitFor({ timeout: 20000 });

const checks = {
  noHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  couponBoxVisible: await page.locator('.coupon-box').isVisible(),
  payEnabled: await page.getByRole('button', { name: /Pay Securely/i }).isEnabled(),
  deliveryChargeShown: /₹80/.test(await page.locator('.summary').innerText()),
};
await page.screenshot({ path: 'mobile-checkout-verify.png', fullPage: true });
console.log('Mobile checkout checks:', JSON.stringify(checks, null, 2));
await browser.close();
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
