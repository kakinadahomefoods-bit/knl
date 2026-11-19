// Read-only audit of the published catalogue. Does not contact MongoDB directly.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const base = 'https://www.cruvitacookies.com';
const response = await fetch(`${base}/api/products?limit=100`);
if (!response.ok) throw new Error(`Catalogue returned HTTP ${response.status}`);
const first = await response.json();
const pages = await Promise.all(Array.from({ length: Math.max(0, (first.pages || 1) - 1) }, async (_, i) => {
  const r = await fetch(`${base}/api/products?limit=100&page=${i + 2}`);
  if (!r.ok) throw new Error(`Catalogue page ${i + 2} returned HTTP ${r.status}`);
  return r.json();
}));
const products = [...(first.products || []), ...pages.flatMap(p => p.products || [])];
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const rows = [['product name', 'product ID', 'slug', 'image 1', 'image 2', 'local files exist', 'match status', 'rendering status', 'action required']];
for (const product of products) {
  const images = product.images || [];
  const exists = images.slice(0, 2).map(url => {
    if (!url.startsWith('/products/')) return 'external/not checked';
    const relative = decodeURIComponent(url.split('?')[0]).replace(/^\/+/, '');
    return existsSync(path.join('public', relative)) ? 'yes' : 'no';
  });
  let match = 'not visually verified';
  let action = 'Visually inspect product, ingredients and both images; confirm approval.';
  if (product.slug === 'choco-chip-butter-cake-300g') {
    match = 'primary visually mismatched: red cookies, not cake';
    action = 'Replace with approved butter cake images.';
  } else if (product.slug === 'mini-chocolate-chip-cookies') {
    match = images.length ? 'mapping needs review; previously inspected local primary showed red cookies' : 'no current images';
    action = 'Provide or assign approved mini chocolate-chip images; visually inspect both.';
  }
  rows.push([product.name, product._id, product.slug, images[0] || '', images[1] || '', exists.join('; ') || 'no images', match, 'not browser verified', action]);
}
mkdirSync('docs', { recursive: true });
writeFileSync('docs/product-image-audit.csv', rows.map(row => row.map(csv).join(',')).join('\n') + '\n');
console.log(`Wrote ${products.length} published products to docs/product-image-audit.csv. Draft products are not included.`);
