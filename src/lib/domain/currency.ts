const DEFAULT_CURRENCY = "ILS";

/**
 * Read the ISO currency code stored by the commerce settings form. Keeping this
 * parser independent from Prisma lets transactions read the setting through
 * their own client while sharing the exact fallback and validation rules.
 */
export function currencyFromSetting(value: unknown): string {
  if (typeof value === "string" && /^[A-Z]{3}$/.test(value)) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = (value as Record<string, unknown>).code;
    if (typeof candidate === "string" && /^[A-Z]{3}$/.test(candidate)) return candidate;
  }
  return DEFAULT_CURRENCY;
}
