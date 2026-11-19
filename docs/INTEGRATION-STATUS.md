# Integration and launch status

This project is a real database-backed storefront with MongoDB products, admin session authentication, Cloudinary uploads, Razorpay checkout with signature verification and webhook reconciliation, and a Delhivery shipping integration. **It is NOT production-ready and has NOT been deployed.**

## Delhivery status

Implemented and verified in the simulation environment:

- PIN serviceability via Delhivery's documented `/c/api/pin-codes/json/` endpoint.
- Shipment creation (`/api/cmu/create.json`) with AWB storage, tracking (`/api/v1/packages/json/`) and label retrieval.
- Delivery quotes with packed weight/dimensions, recalculated on PIN/cart/quantity changes; quote snapshot stored on the order.
- Automatic shipment creation after verified payment, with an atomic claim and a partial unique AWB index to prevent duplicates.
- Customer tracking page and admin create/retry, track and label actions.

**Not implemented (by design, pending account details):**

- Live freight/rate quotes. Delhivery's "Calculate Shipping Cost" API is account-specific and documented only inside the Delhivery One developer portal; no endpoint is invented here. The approved configurable weight/PIN rate fallback is available behind `SHIPPING_RATE_FALLBACK=true` and is OFF by default. Default behaviour remains the store's configurable flat fee / free-shipping threshold.
- Live label URL when the carrier does not return one in the create response — set `DELHIVERY_LABEL_API_URL` from your developer portal if needed.
- Automatic live cancellation — live AWBs must be cancelled in the Delhivery dashboard (simulated shipments can be cancelled locally).

## Launch checklist

1. Supply credentials as **server-only** environment variables: MongoDB, admin session secret, Razorpay (key/secret/webhook secret) and Delhivery (token, base URL, pickup name/PIN, optional label URL). Never commit `.env`/`.env.local`.
2. Test real payments, serviceability, AWB creation, labels and tracking in a **Delhivery staging/test account** before enabling live shipments.
3. Decide on delivery charges: enable the approved fallback explicitly, or provide the account's rate API documentation for live carrier rates.
4. Fix the known Cloudinary API key permission issue (`create` action) and re-run `npm run test:integration`.
5. Configure an email provider if transactional email is needed; add approved photography, prices, labels and policy copy.
6. Run a security/accessibility audit and load test. **Deploy only after explicit approval.**
