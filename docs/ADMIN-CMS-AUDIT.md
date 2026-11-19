# Admin CMS audit and handoff

This is a partial source audit, not a production-readiness assessment. No production
database, media, environment settings, or deployment was changed or backed up.

## Data and architecture

- Next.js App Router serves the React storefront, admin, and API routes. MongoDB
  via Mongoose stores products, categories, content, orders, payments and admins.
  Cloudinary is used for uploaded media; `public/` also contains packaged assets.
- Both the storefront and admin read `/api/products` from the configured MongoDB.
  The public endpoint filters on `published`; the admin endpoint requires a
  session and includes drafts. Before this change the admin requested only the
  default first 60 records while the storefront fetched all pages. The admin now
  fetches all product pages for Products and Inventory. This does not diagnose
  mismatched production environment variables or databases.
- Homepage content is split between MongoDB content documents, hardcoded
  component defaults, packaged images/videos and `lib/story.ts`. Banner records
  use `banner:*` keys, while `homepage.slides` takes precedence in the storefront.
  `HeroCarousel` currently renders only videos; image banners and several editor
  fields do not control the hero. Default videos can be injected by the
  storefront without existing as editable banner records.
- `lib/products.ts` contains explicitly labelled demo data and must not be
  imported as the real catalogue. `scripts/import-products.mjs` uses a different
  domain as a reference, not the Cruvita production API. It is not a Cruvita
  catalogue migration. `scripts/import-content.mjs` replaces existing content
  values and is unsafe for a preservation-first import. Do not run these scripts
  as a production migration.
- Admin sessions are signed cookies backed by server-side session records;
  admin APIs generally call `isAdmin`. This review does not establish complete
  authorization, CSRF, rate limiting, role separation or audit logging.
- Razorpay order creation uses paise and verification checks signatures and
  gateway status before captured-payment finalization. Delhivery integration
  exists, but live account-specific freight rates are not implemented.
  Neither integration was tested against its provider during this audit.
- Storefront catalogue loading occurs on initial client mount; no cross-client
  real-time invalidation was verified. Admin changes require a reload to be
  reflected in a storefront that is already open.

## Before importing

1. Identify the actual deployed MongoDB database and make a verified, restorable
   database backup, including orders and all content. Back up Cloudinary assets
   and deployment configuration separately; a Git backup is not a data backup.
2. Compare the deployed public API with that database without printing secrets
   or customer data. Do not assume local `.env` files target production.
3. Build and review an idempotent, non-destructive reconciliation plan with
   dry-run counts and conflict reporting. Preserve existing IDs and nonempty
   values, and do not infer stock, prices or shipping rules. Test the plan on
   an isolated copy, restore-test the backup, and only then apply it.
4. Resolve the banner representation and migrate legacy slides without silently
   replacing or hiding existing content. Test image and video rendering as well
   as enabling, disabling, ordering and saving.

## Remaining work

The requested comprehensive CMS, media usage tracking, dashboard, customer and
admin-user management, audit logs, settings workflows, integration hardening,
checkout validation and end-to-end tests are not complete. Existing shipping
defaults need explicit business approval. A successful TypeScript check or unit
test run is not evidence that payment, shipping, database persistence or a
production deployment works.
