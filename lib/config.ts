/**
 * Central feature/availability switches.
 * Simulations exist only to develop and test the integration contracts locally.
 * They can never run when NODE_ENV=production, even if credentials are absent.
 */
export const isProduction = () => process.env.NODE_ENV === 'production';

export const razorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const razorpayWebhookConfigured = () => Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

export const devSimulationAllowed = () =>
  !isProduction() && process.env.ALLOW_DEV_SIMULATION !== 'false';

export const paymentSimulationEnabled = () => !razorpayConfigured() && devSimulationAllowed();

export const delhiveryConfigured = () => Boolean(process.env.DELHIVERY_API_TOKEN);

/** Admin Settings is authoritative; this env value is the server-side default. */
export const delhiveryEnabled = () => process.env.DELHIVERY_ENABLED === 'true';

export type FallbackShippingMethod = 'none' | 'flat_fee' | 'rate_card';

/** Manual shipping must be explicitly approved. */
export const defaultFallbackShippingMethod = (): FallbackShippingMethod => {
  const value = process.env.SHIPPING_FALLBACK_METHOD;
  return value === 'flat_fee' || value === 'rate_card' ? value : 'none';
};

export const shippingSimulationEnabled = () => !delhiveryConfigured() && devSimulationAllowed();

/** Live freight quotes are account-specific; this stays false until the account's
 *  "Calculate Shipping Cost" API details are supplied from the developer portal. */
export const delhiveryRateApiEnabled = () => process.env.DELHIVERY_RATE_API_ENABLED === 'true';

/** Approved configurable fallback (weight/PIN based). Off unless explicitly enabled. */
export const shippingRateFallbackEnabled = () => process.env.SHIPPING_RATE_FALLBACK === 'true';

export const emailConfigured = () => Boolean(process.env.EMAIL_PROVIDER_API_KEY);

export const freeShippingThreshold = () => {
  const n = Number(process.env.FREE_SHIPPING_THRESHOLD ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const flatShippingFee = () => {
  const n = Number(process.env.FLAT_SHIPPING_FEE ?? NaN);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export const contactEmail = () => process.env.CONTACT_EMAIL || 'cruvitacookies7@gmail.com';
