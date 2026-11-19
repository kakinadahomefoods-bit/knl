# Cruvita Cookies — full-stack storefront and admin

Next.js 15 + React 19 + TypeScript storefront and admin dashboard backed by MongoDB Atlas, Cloudinary, Razorpay and Delhivery. Customer checkout is guest-only; the admin area requires a password login.

Brand email: **cruvitacookies7@gmail.com**

---

## 1. Local setup

1. Node.js 20+ required.
2. Copy `.env.example` to `.env.local` and fill in the values you have. Never commit `.env.local` (it is gitignored).
3. `npm install`
4. `npm run create-admin` — prompts for an admin email and a password of at least 12 characters. For non-interactive use:
   ```
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run create-admin
   ```
   There is **no default admin password**.
5. `npm run seed:content` — creates default settings, homepage content and three categories using `$setOnInsert`; existing data is never overwritten.
6. `npm run dev` → http://localhost:3000 and http://localhost:3000/admin
7. Add products through the admin panel. The storefront only shows products marked **Published**; there is no fabricated catalogue.

> Your `MONGODB_URI` currently has no database name, so MongoDB uses the default `test` database. Appending a name such as `/cruvita_cookies` is recommended before launch.

## 2. Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | Yes |
| `ADMIN_SESSION_SECRET` | HMAC secret for admin sessions | Yes |
| `NEXT_PUBLIC_SITE_URL` | Public site URL | Yes |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image uploads | Yes |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Live payments | No (dev simulation used when absent) |
| `DELHIVERY_API_TOKEN`, `DELHIVERY_API_BASE_URL`, `DELHIVERY_PICKUP_NAME` | Live shipping (server-only) | No (dev simulation used when absent) |
| `DELHIVERY_PICKUP_PIN` | Pickup PIN used by quotes/rate fallback (default `518502`) | No |
| `DELHIVERY_LABEL_API_URL` | Exact label API URL from your Delhivery One developer portal; use `{awb}` | No |
| `FREE_SHIPPING_THRESHOLD`, `FLAT_SHIPPING_FEE` | Default shipping rules; admin Settings values override these | Optional (defaults 999 / 80) |
| `SHIPPING_DEFAULT_WEIGHT_GRAMS`, `SHIPPING_DEFAULT_*_CM`, `SHIPPING_VOLUMETRIC_DIVISOR` | Packed-weight/dimension defaults | No |
| `SHIPPING_RATE_FALLBACK`, `SHIPPING_RATE_CARD` | Approved configurable weight/PIN rate fallback (OFF by default) | No |
| `DELHIVERY_RATE_API_ENABLED` | Reserved for the account-specific live freight API; no URL is invented | No |
| `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, `EMAIL_API_URL` | Resend-compatible email | No |
| `CONTACT_EMAIL` | Storefront contact email fallback | Optional |
| `ALLOW_DEV_SIMULATION` | Set `false` to disable simulations in development | Optional |

**Simulations never run when `NODE_ENV=production`.** If Razorpay/Delhivery credentials are missing in production, checkout/shipment endpoints return an explicit configuration error instead of creating fake orders or AWBs.

## 3. Implemented features

### Storefront
- Homepage with Cloudinary-powered hero banner and category cards
- Real product listings from MongoDB with category filters, text search and sorting
- Product detail pages with image gallery and stock status (`/product/[slug]`)
- Cart, wishlist, guest checkout, order confirmation, guest order tracking
- About, contact and separate Shipping / Refund / Privacy / Terms policy pages
- Logo, announcement, store name and policy text driven by admin content settings
- Responsive layout using the approved Cruvita design language

### Data and inventory
- Mongoose collections: products, categories, orders, coupons, content, admins, payments, media
- Indexes on slugs, codes, order numbers, tracking tokens, order/payment status
- Server-side validation, server-calculated pricing, idempotency keys to prevent duplicate orders
- Idempotent payment finalization with a MongoDB transaction: all-or-nothing stock decrement and coupon usage commit
- Refunds with Razorpay API, restock on full refund, order cancellation with restock
- Admin product edits publish to the storefront immediately

### Cloudinary
- Admin uploads to allowlisted folders: products, banners, categories, logo
- Multiple images per product; public IDs stored in MongoDB
- Auto format/quality delivery URLs (`f_auto,q_auto`)
- Media manager that refuses to delete images still referenced by products, categories or content

### Payments (Razorpay)
- Server-side order creation, checkout widget integration, payment signature verification
- Signed webhook verification, reconciliation endpoint, payment records, duplicate-payment protection
- Failed-payment and refund handling
- Clearly labelled development simulation that is impossible in production

### Shipping (Delhivery)
- PIN serviceability check (official `/c/api/pin-codes/json/`), shipment creation (`/api/cmu/create.json`) with AWB storage, tracking (`/api/v1/packages/json/`), label retrieval and admin shipment list
- Product-page and checkout PIN checker; server-side delivery quote recalculated when PIN, cart, quantities or coupon change
- Packed weight/dimensions computed from product data (volumetric weight included); quote snapshot stored on each order
- Shipment is created automatically once payment is verified; an atomic claim plus a partial unique AWB index prevent duplicates
- Customer tracking on the confirmation page and at `/track`; admin create/retry, track and label actions
- Development simulator with `SIM…` AWBs and `simulated` flags in data and UI

### Email
- Templates for order confirmation, payment confirmation, shipping, delivery, cancellation and refund
- Sends only when a provider key is configured; delivery status is recorded on each order as `sent`/`not sent`

## 3.1 Delhivery rate calculation — important limitation

Delhivery's public help centre documents **serviceability, shipment creation, tracking and labels**, and lists a **“Calculate Shipping Cost” API** in the *Client Developer Portal*. The freight/rate calculator is otherwise a Delhivery One UI tool (“Information Center → Rate Calculator”), and rates depend on your contract and shipping volume. The exact rate API endpoint, request schema and account entitlement are documented **only after logging in to Delhivery One** at `https://ucp.delhivery.com/developer-portal/documents`.

**No carrier rate endpoint is hardcoded or guessed in this codebase.** The checkout therefore uses:

1. **Live serviceability** from Delhivery (or a clearly labelled dev simulation).
2. **Delivery charge** from one of these sources, in order:
   - `DELHIVERY_RATE_API_ENABLED=true` → deliberately fails with a configuration error until your account-specific rate API details are supplied (never a guessed URL).
   - `SHIPPING_RATE_FALLBACK=true` → the **approved, configurable store rate card** (`SHIPPING_RATE_CARD`) based on packed billable weight, pickup PIN and destination PIN. This is a business rule, **not** a Delhivery quote. It is OFF until you enable it.
   - Default → the existing configurable flat fee / free-shipping threshold from admin Settings (env fallback 80 / 999).

The same function (`quoteForCart`) powers the browser estimate, `/api/shipping/quote` and the authoritative checkout total, so the displayed charge equals the charged amount. To enable the approved fallback, set `SHIPPING_RATE_FALLBACK=true` and optionally supply a `SHIPPING_RATE_CARD` JSON object (see `.env.example`). Live carrier rates can be wired later once you provide the documented endpoint and sample request/response from your account.

## 4. Commands

```bash
npm run dev             # development server
npm run build           # production build
npm run start           # production server
npm run lint            # TypeScript check
npm test                # unit tests (pricing, validation, simulation)
npm run test:integration # end-to-end smoke test
npm run create-admin    # create/update an admin
npm run seed:content    # upsert default content only
```

`npm run test:integration` starts its own dev server with an isolated `.next-smoke` directory and a **throwaway MongoDB database**, exercises public pages, admin auth, product/category creation, checkout, simulated payment, inventory, tracking, shipments and webhook rejection, then drops the throwaway database. It never touches your live data.

## 5. GitHub deployment

```bash
git init
git add .
git commit -m "Cruvita Cookies full-stack implementation"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

`.gitignore` excludes `node_modules`, `.next`, `.next-smoke`, `.test-build`, `.env`, `.env.local`, `*.log` and `*.tsbuildinfo`. Verify with `git status` that no credential file is staged before committing.

## 6. Vercel deployment

1. Import the GitHub repository into Vercel; framework preset **Next.js**.
2. Add every variable from `.env.example` in **Project → Settings → Environment Variables** (Production and Preview). Use the real MongoDB URI with an explicit database name.
3. Keep `ALLOW_DEV_SIMULATION` unset or `false` in Production.
4. Configure the Razorpay webhook in the Razorpay dashboard to `https://<your-domain>/api/payments/webhook` and set `RAZORPAY_WEBHOOK_SECRET` to the same secret.
5. Build command `npm run build`, output preset `.next`. Deploy only after the checks below are green.
6. Create the production admin after deployment with `ADMIN_EMAIL` / `ADMIN_PASSWORD` set for a one-off Node process connected to the same MongoDB URI.

## 7. Verification status (this environment)

| Check | Result |
|---|---|
| `npm run lint` (TypeScript) | Pass |
| `npm run build` (production build, 44 routes) | Pass |
| `npm test` (21 unit tests, incl. packed weight/rate card/tracking) | Pass |
| `npm run test:integration` | 32 / 33 checks pass (including auto-shipment, duplicate guard, quote and label) |
| MongoDB Atlas connectivity | Pass (read/write in throwaway DB; live DB untouched) |
| Cloudinary authentication (`api.ping`) | Pass |
| Cloudinary upload | **Blocked:** supplied API key returns `403 … missing permissions (actions=["create"])`. An API key with upload/create permission is required. |
| Razorpay live payments | Not tested — credentials not supplied |
| Delhivery live shipments / rate API | Not tested — credentials and account-specific rate API details not supplied. All shipping tests use the clearly labelled simulation. |
| Email delivery | Not tested — provider not configured |
| Production deployment | **Not performed — awaiting approval** |

## 8. Remaining work before production

1. Replace the Cloudinary API key with one that has upload permission (or enable upload permission on the existing key), then re-run `npm run test:integration`.
2. Supply Razorpay and Delhivery credentials, webhook secret and pickup configuration; test real payments, refunds, serviceability, AWB creation, labels and tracking in a Delhivery staging/test account before enabling live shipments. If you want weight/PIN based charges, explicitly set `SHIPPING_RATE_FALLBACK=true` (approved fallback); if you want true carrier freight, provide the account-specific "Calculate Shipping Cost" API documentation so it can be wired without inventing an endpoint.
3. Configure an email provider if transactional email is needed.
4. Add authorized product photography, verified prices, food labels and approved policy copy via the admin panel.
5. Run a security/accessibility audit and load test before accepting real orders.
6. Consider adding a database reservation collection for high-concurrency stock scenarios; current stock decrement is transactional but does not reserve stock while a payment is in progress.
