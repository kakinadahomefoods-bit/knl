import mongoose from 'mongoose';
import { writeFile } from 'node:fs/promises';

// Reference prices and images are evidence only, never approved storefront assets.
// Existing products are not overwritten; missing products are inserted as drafts.
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');
const base = 'https://www.crusantcookies.com';
const sources = ['/', '/collections/fullrange-1', '/collections/cookies', '/collections/brownies',
  '/collections/gift-boxes', '/collections/bestsellers', '/collections/bestsellers-1', '/collections/promo-gift-1'];
const observedAt = new Date();
const records = new Map();
const errors = [];
const decode = (s = '') => s.replace(/<!--.*?-->/gs, '').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
const match = (s, re) => decode(s.match(re)?.[1] || '');

for (const source of sources) {
  try {
    const response = await fetch(base + source, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const html = await response.text();
    const cards = html.split(/(?=class="[^"]*pr-long-card)/);
    for (const card of cards) {
      const path = card.match(/href="(\/products\/[^"?#]+)"/)?.[1];
      if (!path) continue;
      const slug = path.slice('/products/'.length);
      const name = match(card, /class="[^"]*pr-title[^"]*"[^>]*>(.*?)<\/h3>/s);
      if (!name) continue;
      const price = match(card, /class="[^"]*pr-sale-price[^"]*"[^>]*>(.*?)<\/h3>/s);
      const mrp = match(card, /class="[^"]*pr-mrp-price[^"]*"[^>]*>(.*?)<\/s>/s);
      const img = card.match(/<img[^>]+src="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
      const prior = records.get(slug);
      if (prior) { if (!prior.sources.includes(base + source)) prior.sources.push(base + source); continue; }
      records.set(slug, {
        slug, name, productUrl: base + path, sources: [base + source],
        referencePrice: Number(price.replace(/[^\d.]/g, '')) || null,
        referenceMrp: Number(mrp.replace(/[^\d.]/g, '')) || null,
        imageReferences: img ? [img] : [], observedAt,
      });
    }
  } catch (error) { errors.push({ source, error: error.message }); }
}
if (!records.size) throw Error('No reference products could be verified; no database changes made');

// Capture structured facts from each individual product page. Unknown facts are
// left unset rather than inferred from unrelated products or invented.
for (const item of records.values()) {
  try {
    const response = await fetch(item.productUrl, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const html = await response.text();
    const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)];
    const product = blocks.map((block) => { try { return JSON.parse(block[1]); } catch { return null; } })
      .find((block) => block?.['@type'] === 'Product');
    if (!product) throw Error('Product structured data unavailable');
    item.individualPage = {
      name: product.name, description: product.description, sku: product.sku,
      offers: product.offers, imageReferences: product.image,
      variants: product.hasVariant || null, observedAt,
    };
    item.sources.push(item.productUrl);
  } catch (error) { errors.push({ source: item.productUrl, error: error.message }); }
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
const products = mongoose.connection.collection('products');
const evidence = mongoose.connection.collection('reference_catalogue');
const report = { observedAt, discovered: records.size, created: 0, updated: 0, skipped: 0, errors, products: [] };
try {
  for (const item of records.values()) {
    try {
      const existing = await products.findOne({ slug: item.slug });
      const result = await evidence.updateOne({ source: base, slug: item.slug },
        { $set: { ...item, source: base } }, { upsert: true });
      let status = 'existing preserved';
      if (!existing) {
        const category = /cake/i.test(item.name) ? 'Cakes' : /brownie/i.test(item.name) ? 'Brownies' : /cookie/i.test(item.name) ? 'Cookies' : 'Other';
        await products.insertOne({
          slug: item.slug, name: item.name, category, price: null, stock: 0,
          images: [], publicIds: [], variants: [], published: false, featured: false,
          createdAt: observedAt, updatedAt: observedAt,
          referenceSource: { source: base, slug: item.slug },
        });
        status = 'created draft; awaiting approved price and image';
        report.created++;
      } else {
        report.skipped++;
      }
      if (result.modifiedCount) report.updated++;
      report.products.push({ slug: item.slug, status, published: existing?.published ?? false,
        imageApproval: 'unverified', priceApproval: 'unverified' });
    } catch (error) { report.errors.push({ slug: item.slug, error: error.message }); }
  }
  report.totalProducts = await products.countDocuments();
  report.publishedProducts = await products.countDocuments({ published: true });
  report.draftProducts = await products.countDocuments({ published: { $ne: true } });
  await writeFile('reference-import-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, products: undefined }, null, 2));
} finally { await mongoose.disconnect(); }
if (errors.length || report.errors.length) process.exitCode = 1;
