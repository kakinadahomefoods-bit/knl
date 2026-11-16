/** Pure validation helpers — safe to unit test. */

export type CustomerLike = Record<string, unknown>;
export type CartLike = { id?: unknown; qty?: unknown };

export function validateCustomer(c: CustomerLike | null | undefined): string | null {
  if (!c || typeof c !== 'object') return 'Valid delivery details required';
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  const email = typeof c.email === 'string' ? c.email.trim() : '';
  const phone = typeof c.phone === 'string' ? c.phone.trim() : '';
  const pin = typeof c.pin === 'string' ? c.pin.trim() : '';
  const address = typeof c.address === 'string' ? c.address.trim() : '';
  const city = typeof c.city === 'string' ? c.city.trim() : '';
  const state = typeof c.state === 'string' ? c.state.trim() : '';
  if (!name || name.length > 120) return 'Enter a valid name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return 'Enter a valid email';
  if (!/^[0-9]{10}$/.test(phone)) return 'Enter a valid 10-digit mobile number';
  if (!/^[0-9]{6}$/.test(pin)) return 'Enter a valid 6-digit PIN code';
  if (!address || address.length > 500) return 'Enter a valid address';
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
