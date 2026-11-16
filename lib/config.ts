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

export const shippingSimulationEnabled = () => !delhiveryConfigured() && devSimulationAllowed();

export const emailConfigured = () => Boolean(process.env.EMAIL_PROVIDER_API_KEY);

export const freeShippingThreshold = () => {
  const n = Number(process.env.FREE_SHIPPING_THRESHOLD ?? 999);
  return Number.isFinite(n) && n >= 0 ? n : 999;
};

export const flatShippingFee = () => {
  const n = Number(process.env.FLAT_SHIPPING_FEE ?? 80);
  return Number.isFinite(n) && n >= 0 ? n : 80;
};

export const contactEmail = () => process.env.CONTACT_EMAIL || 'cruvitacookies7@gmail.com';
