import { adminDenied, isAdmin } from '@/lib/security';
import { getShippingSettings } from '@/lib/shipping-service';
import {
  delhiveryConfigured,
  delhiveryRateApiEnabled,
  razorpayConfigured,
  shippingRateFallbackEnabled,
} from '@/lib/config';

export const runtime = 'nodejs';

/** Admin-only diagnostics: reports *whether* server credentials exist, never their values. */
export async function GET() {
  if (!(await isAdmin())) return adminDenied();
  const s = await getShippingSettings();
  return Response.json({
    delhivery: {
      enabledInSettings: s.delhiveryEnabled,
      credentialsConfiguredOnServer: delhiveryConfigured(),
      live: s.delhiveryEnabled && delhiveryConfigured(),
      pickupPinConfigured: Boolean(s.pickupPin),
      pickupNameConfigured: Boolean(s.pickupName),
      rateApiEnabled: delhiveryRateApiEnabled(),
    },
    fallback: {
      method: s.fallbackShippingMethod,
      rateCardEnvEnabled: shippingRateFallbackEnabled(),
      flatFee: s.flatShippingFee,
      freeShippingThreshold: s.freeShippingThreshold,
    },
    payments: { razorpayConfigured: razorpayConfigured() },
  });
}
