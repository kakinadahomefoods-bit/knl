/** Pure validation helpers — safe to unit test. */

export type CustomerLike = Record<string, unknown>;
export type CartLike = { id?: unknown; qty?: unknown };

/** Compose the stored delivery address from the structured checkout fields.
 *  Legacy clients that only send `address` keep working unchanged. */
export function formatAddress(c: CustomerLike | null | undefined): string {
  if (!c || typeof c !== 'object') return '';
  const text = (key: string) => typeof c[key] === 'string' ? (c[key] as string).trim() : '';
  const houseNo = text('houseNo');
  const street = text('street');
  const landmark = text('landmark');
  if (!houseNo && !street) return text('address');
  return [houseNo, street, landmark ? `Landmark: ${landmark}` : ''].filter(Boolean).join(', ');
}

export function validateCustomer(c: CustomerLike | null | undefined): string | null {
  if (!c || typeof c !== 'object') return 'Valid delivery details required';
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  const email = typeof c.email === 'string' ? c.email.trim() : '';
  const phone = typeof c.phone === 'string' ? c.phone.trim() : '';
  const pin = typeof c.pin === 'string' ? c.pin.trim() : '';
  const houseNo = typeof c.houseNo === 'string' ? c.houseNo.trim() : '';
  const street = typeof c.street === 'string' ? c.street.trim() : '';
  const landmark = typeof c.landmark === 'string' ? c.landmark.trim() : '';
  const address = formatAddress(c);
  const city = typeof c.city === 'string' ? c.city.trim() : '';
  const state = typeof c.state === 'string' ? c.state.trim() : '';
  if (!name || name.length > 120) return 'Enter a valid name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return 'Enter a valid email';
  if (!/^[0-9]{10}$/.test(phone)) return 'Enter a valid 10-digit mobile number';
  if (!/^[0-9]{6}$/.test(pin)) return 'Enter a valid 6-digit PIN code';
  if (!address || address.length > 500) return 'Enter a valid house/flat number and street/area';
  // Structured checkout must provide both parts; legacy clients may send only `address`.
  if ((houseNo || street || landmark) && (!houseNo || !street)) return 'Enter a valid house/flat number and street/area';
  if (houseNo.length > 80 || street.length > 200 || landmark.length > 120) return 'Delivery address is too long';
  if (!city || city.length > 120 || !state || state.length > 120) return 'Enter a valid city and state';
  return null;
}

export function validateCart(items: CartLike[] | null | undefined, maxLines = 40): string | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > maxLines) return 'Invalid cart';
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item?.id !== 'string' || !/^[a-f\d]{24}$/i.test(item.id)) return 'Invalid product';
    if (seen.has(item.id)) return 'Duplicate item in cart';
    seen.add(item.id);
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return 'Invalid quantity';
  }
  return null;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}
