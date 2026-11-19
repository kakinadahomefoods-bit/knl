# Cleanup audit manifest

Audit date: 2026-11-19. Branch created: `cleanup/repository-audit`.

## Recovery and changes

- Removed files: none. Removed dependencies: none. Space saved: 0 bytes.
- No database records, environment files, external assets, or deployments were changed.
- The initial local HEAD was `23a7799da699882c8a5ea5d2b4e5128a46610397`. During the audit another commit, `cf0d783` (Improve storefront and admin catalogue), appeared and files continued to change. Check the current Git status before further work.
- `.git/cleanup-preexisting-work.zip` contains `.verify-server.mjs` as observed when the archive was created. It is **not** a complete backup of the initial working tree; do not rely on it as one. The concurrent commit contains previously uncommitted work, but later changes must be backed up separately before cleanup.
- Remote `origin/main` resolved to `dd6453ede9f7b6f9b21a1cef7fb0381d1151e502`. This is a Git reference, not verified to be the active production deployment. No deployment metadata was available to establish the actual deployed commit.

## Audit scope and findings

- A filesystem inventory counted 303 files excluding `.git`, `node_modules`, `.next`, `.next-smoke`, `.next-hero-verify`, `.test-build`, and `test-results`; these exclusions prevent this count from representing the complete repository. Files were changing concurrently.
- SHA-256 hashing of 151 files under `public` found two duplicate pairs (two redundant byte copies):
  - `public/products/classic-chocolate-brownie-pack-of-6-1.png` and `public/products/double-chocolate-brownies-pack-of-6-1.png`
  - `public/products/classic-chocolate-brownie-pack-of-6-2.png` and `public/products/double-chocolate-brownies-pack-of-6-2.png`
- These product URLs may be stored separately in products, orders, CMS content or external links. Both pairs are category B: retain until a read-only production database/CMS and historical reference review confirms safe migration.
- `.next-hero-verify` contains 320 generated files totaling 131,486,985 bytes and is tracked in Git. Its current use and the need for its cached state are unconfirmed; retain for review. Do not remove build caches without establishing necessity and recovery.
- `next.config.js` and `next.config.mjs` coexist and differ; `next.config.js` includes uncommitted/recent thumbnail cache headers. Preserve both pending configuration and deployment review.
- `scripts/set-product*-images.mjs`, import/update/removal scripts, `reference-import-report.json`, and `docs/product-image-audit.csv` may represent historical data operations and evidence. Review with the owner before removal; do not run database-mutating scripts as part of cleanup.
- `story-1440.png` and `story-390.png` appear to be review screenshots, but their ownership and retention requirements are unconfirmed. Preserve pending review.
- All product media, original media, videos, thumbnail assets, admin, payments, shipping, authentication, schemas, scripts, configurations, environment files, and existing documentation were preserved. No API or dependency was established safe to remove.
- Database/CMS records and external storage were not audited; no claim is made that all media references or routes are known. Dependency, route, environment, and deployment analyses remain incomplete.

## Verification and limitations

- `npm run lint`: passed (`tsc --noEmit`).
- `npm test`: passed, 29 tests.
- The public homepage returned HTML/text when fetched; interactive rendering, product imagery and transactions were not verified.
- Production build and integration/E2E tests were not run. `scripts/run-e2e.mjs` deletes `.next`, and `scripts/smoke-test.mjs` deletes `.next-smoke` and uses a remote throwaway database and Cloudinary test uploads. These are unsuitable while other work is active and without confirming isolation and external side effects.
- Razorpay, Delhivery, checkout, admin, synchronization, historical orders, full image URLs and deployment status remain unverified.

## Before resuming

1. Coordinate a stable working tree; back up all current modified and untracked files without including secrets in a shared archive.
2. Establish the actual production deployment reference and read-only access to CMS/database media references, including historical records and external URL consumers.
3. Review generated build artifacts, potential screenshots, legacy scripts and duplicate media with their owner.
4. Run builds and functional tests in a genuinely isolated workspace with isolated outputs and non-production services, after checking all test side effects.
5. Only after a recoverable backup, remove individually verified category A files and record each path, reason, size, hash, and restoration method here. Category B requires approval; preserve category C.
