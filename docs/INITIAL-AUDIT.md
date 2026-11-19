# Initial audit — 19 November 2026

This is a partial, point-in-time audit, not a launch approval.

## Verified

- The apex domain resolved to `216.198.79.1` and returned HTTPS 308 to `https://www.cruvitacookies.com/`. The www hostname resolved through Vercel DNS and returned HTTPS 200. This validates connectivity and certificate trust from this environment only, not worldwide availability.
- The public product API returned HTTP 200 in one request taking approximately 5.66 seconds; this is not a performance benchmark.
- The deployed `/robots.txt` and `/sitemap.xml` returned 404. This branch adds basic routes; the sitemap currently lists only stable static public pages, not products.
- `public/products/choco-chip-butter-cake-300g-1.png` visibly depicts red cookies rather than butter cake. Replace with owner-approved imagery. A previously inspected local `mini-chocolate-chip-cookies-1.png` also depicted red cookies; the published mapping changed during this audit and requires fresh visual review. See `product-image-audit.csv` for the point-in-time public catalogue snapshot; it excludes drafts and does not claim uninspected images are correct.
- `npm audit --omit=dev` reported two vulnerabilities, including high-severity PostCSS advisories via Next.js. A forced major framework upgrade was not applied without compatibility testing.
- The initial `npm ci` failed with EPERM on a locked Windows SWC binary. `npm install` completed with a cleanup warning.
- Before changes: TypeScript passed, 12 unit tests passed, and a production build passed. After changes: TypeScript passed and an isolated production build passed. A normal build attempt was interrupted and a subsequent normal build exited early without diagnostic; no cause established.
- The previous hero change disabled looping even for configured loop slides, and unconditional HTML autoplay could conflict with reduced-motion preferences. This branch restores the configured loop flag and leaves playback to the existing preference-aware effect.

## Unverified risks and blockers

- Vercel domain settings, certificate expiration, logs, production environment variables, and geographic accessibility have not been independently audited.
- Full product/asset visual review, image ownership, prices, ingredients, duplicate-image detection, browser rendering, cart and checkout, payment sandbox, refunds, shipping, email, accessibility, responsive screenshots, Core Web Vitals and Lighthouse have not been verified.
- Product detail routes render a client-side storefront; unique server-rendered metadata and indexability need investigation. Product URLs are not yet included in the new sitemap.
- The integration smoke script can create and drop a throwaway database and manipulate Cloudinary uploads. It was not run against the configured external services during this audit.
- Git backup is a bundle of tracked history at `%TEMP%\\opencode\\cruvita-before-audit.bundle`; it is not a backup of MongoDB, ignored files, uploaded media, or Vercel configuration.
- Other changes and assets appeared in the working tree during the audit. They were left intact; review ownership and intended deployment scope before committing.

## Release checklist

1. Review every image against the approved catalogue; replace mismatches without overwriting originals.
2. Complete sandbox checkout/webhook/refund/shipping tests with isolated credentials and data.
3. Perform dependency remediation, security and accessibility reviews, responsive browser testing and measured Lighthouse audits.
4. Verify product SEO and extend the sitemap using published product URLs with failure handling.
5. Verify Vercel domains, logs and environment settings. Do not deploy without explicit approval.
