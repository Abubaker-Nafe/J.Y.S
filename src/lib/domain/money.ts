export type MoneyInput = string | number | { toString(): string };

export function moneyToMinor(value: MoneyInput): number {
  const normalized = value.toString().trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid monetary value: ${normalized}`);
  }
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error("Monetary value exceeds safe range");
  return negative ? -minor : minor;
}

export function minorToMoney(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new Error("Minor amount must be a safe integer");
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function calculateOrderTotals(
  lines: ReadonlyArray<{ unitPriceMinor: number; quantity: number }>,
): { subtotalMinor: number; totalMinor: number } {
  const subtotalMinor = lines.reduce((sum, line) => {
    if (!Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor < 0) {
      throw new Error("Unit price cannot be negative");
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error("Quantity must be a positive integer");
    }
    const lineTotal = line.unitPriceMinor * line.quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(sum + lineTotal)) {
      throw new Error("Order total exceeds safe range");
    }
    return sum + lineTotal;
  }, 0);
  return {
    subtotalMinor,
    totalMinor: subtotalMinor,
  };
}

