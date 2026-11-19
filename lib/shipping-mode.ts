/**
 * Pure decision logic for which shipping method a checkout may use.
 * No network, database or framework access: safe to unit test.
 *
 * Rules:
 *  - Delhivery is used only when enabled by admin settings AND a server token exists.
 *  - Otherwise an explicitly approved manual fallback may supply the charge and the
 *    order is fulfilled by the store (no carrier AWB is ever attempted).
 *  - If neither exists, checkout is blocked with a customer-friendly message.
 *  - Development simulation is a separate, dev-only mode.
 */
import type { FallbackShippingMethod } from './config';

export type ShippingMode = 'delhivery' | 'manual' | 'simulation' | 'unconfigured';

export type CheckoutErrorCode =
  | 'PIN_INVALID'
  | 'SHIPPING_NOT_CONFIGURED'
  | 'SHIPPING_UNAVAILABLE'
  | 'COUPON_INVALID'
  | 'CART_INVALID'
  | 'RATE_API_NOT_CONFIGURED';

export type ResolvedShipping = {
  mode: ShippingMode;
  delhiveryLive: boolean;
  rateSource: 'delhivery_rate_api' | 'rate_card' | 'flat_fee';
  errorCode?: CheckoutErrorCode;
  friendlyError?: string;
};

export type ResolveShippingInput = {
  delhiveryEnabled: boolean;
  delhiveryTokenConfigured: boolean;
  shippingSimulationAllowed: boolean;
  fallbackShippingMethod: FallbackShippingMethod;
  delhiveryRateApiEnabled: boolean;
};

export function resolveShippingMode(input: ResolveShippingInput): ResolvedShipping {
  const live = Boolean(input.delhiveryEnabled && input.delhiveryTokenConfigured);
  const rateSource: ResolvedShipping['rateSource'] = live && input.delhiveryRateApiEnabled
    ? 'delhivery_rate_api'
    : input.fallbackShippingMethod === 'rate_card' ? 'rate_card' : 'flat_fee';

  if (live) return { mode: 'delhivery', delhiveryLive: true, rateSource };
  if (input.shippingSimulationAllowed) return { mode: 'simulation', delhiveryLive: false, rateSource };
  if (input.fallbackShippingMethod !== 'none') {
    return { mode: 'manual', delhiveryLive: false, rateSource };
  }
  return {
    mode: 'unconfigured',
    delhiveryLive: false,
    rateSource,
    errorCode: 'SHIPPING_NOT_CONFIGURED',
    friendlyError: 'Delivery is currently unavailable for your area. Please contact the store for assistance.',
  };
}
