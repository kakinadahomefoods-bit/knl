/**
 * Extract only error class names and machine-readable error codes. Driver messages,
 * server addresses, topology descriptions and connection strings are never logged.
 */
export function mongoErrorSummary(error: unknown) {
  const names = new Set<string>();
  const codes = new Set<string>();
  const seen = new Set<unknown>();
  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 4) return;
    seen.add(value);
    const item = value as Record<string, any>;
    if (typeof item.name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,80}$/.test(item.name)) names.add(item.name);
    if ((typeof item.code === 'number' && Number.isInteger(item.code)) ||
        (typeof item.code === 'string' && /^[A-Z][A-Z0-9_]{0,30}$/.test(item.code))) codes.add(String(item.code));
    visit(item.cause, depth + 1);
    visit(item.reason, depth + 1);
    visit(item.error, depth + 1);
    if (item.servers instanceof Map) {
      for (const server of item.servers.values()) visit(server, depth + 1);
    }
  }
  visit(error, 0);
  return { names: [...names], codes: [...codes] };
}
