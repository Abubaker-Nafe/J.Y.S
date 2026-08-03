import { minorToMoney, moneyToMinor, type MoneyInput } from "./money";

export type SaleStatus = "DISABLED" | "INVALID" | "SCHEDULED" | "ACTIVE" | "EXPIRED";

export interface SaleConfiguration {
  normalPrice: MoneyInput;
  isOnSale: boolean;
  salePrice?: MoneyInput | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  productActive?: boolean;
  archived?: boolean;
}

export interface ResolvedPricing {
  normalPrice: string;
  effectivePrice: string;
  discountAmount: string;
  discountPercentage: number;
  isOnSale: boolean;
  status: SaleStatus;
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Pricing denominator must be positive");
  return (numerator + denominator / 2n) / denominator;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validateSaleConfiguration(input: SaleConfiguration): string[] {
  const errors: string[] = [];
  let normalMinor = 0;
  let saleMinor = 0;
  try {
    normalMinor = moneyToMinor(input.normalPrice);
  } catch {
    errors.push("NORMAL_PRICE_INVALID");
  }
  if (input.isOnSale) {
    if (input.salePrice === null || input.salePrice === undefined || input.salePrice === "") {
      errors.push("SALE_PRICE_REQUIRED");
    } else {
      try {
        saleMinor = moneyToMinor(input.salePrice);
      } catch {
        errors.push("SALE_PRICE_INVALID");
      }
      if (saleMinor <= 0) errors.push("SALE_PRICE_POSITIVE");
      if (normalMinor > 0 && saleMinor >= normalMinor) errors.push("SALE_PRICE_BELOW_NORMAL");
    }
  }
  const startsAt = toDate(input.saleStartsAt);
  const endsAt = toDate(input.saleEndsAt);
  if (input.saleStartsAt && !startsAt) errors.push("SALE_START_INVALID");
  if (input.saleEndsAt && !endsAt) errors.push("SALE_END_INVALID");
  if (startsAt && endsAt && startsAt >= endsAt) errors.push("SALE_WINDOW_INVALID");
  return Array.from(new Set(errors));
}

export function salePriceFromPercentage(normalPrice: MoneyInput, percentage: MoneyInput): string {
  const normalMinor = moneyToMinor(normalPrice);
  const percentageBasisPoints = moneyToMinor(percentage);
  if (normalMinor <= 0) throw new Error("Normal price must be positive");
  if (percentageBasisPoints <= 0 || percentageBasisPoints >= 10_000) {
    throw new Error("Discount percentage must be greater than 0 and less than 100");
  }
  const saleMinor = Number(roundRatio(BigInt(normalMinor) * BigInt(10_000 - percentageBasisPoints), 10_000n));
  if (saleMinor <= 0 || saleMinor >= normalMinor) throw new Error("Discount does not produce a valid sale price");
  return minorToMoney(saleMinor);
}

export function percentageFromSalePrice(normalPrice: MoneyInput, salePrice: MoneyInput): number {
  const normalMinor = moneyToMinor(normalPrice);
  const saleMinor = moneyToMinor(salePrice);
  if (normalMinor <= 0 || saleMinor <= 0 || saleMinor >= normalMinor) return 0;
  const hundredths = Number(roundRatio(BigInt(normalMinor - saleMinor) * 10_000n, BigInt(normalMinor)));
  return hundredths / 100;
}

export function resolveSalePricing(
  input: SaleConfiguration,
  variantNormalPrice?: MoneyInput | null,
  now: Date = new Date(),
): ResolvedPricing {
  const baseNormalMinor = moneyToMinor(input.normalPrice);
  const normalMinor = moneyToMinor(variantNormalPrice ?? input.normalPrice);
  const invalid = validateSaleConfiguration(input).length > 0 || baseNormalMinor <= 0 || normalMinor <= 0;
  const startsAt = toDate(input.saleStartsAt);
  const endsAt = toDate(input.saleEndsAt);
  let status: SaleStatus = "DISABLED";

  if (input.isOnSale) {
    if (invalid) status = "INVALID";
    else if (input.productActive === false || input.archived === true) status = "DISABLED";
    else if (startsAt && now < startsAt) status = "SCHEDULED";
    else if (endsAt && now > endsAt) status = "EXPIRED";
    else status = "ACTIVE";
  }

  let effectiveMinor = normalMinor;
  if (status === "ACTIVE") {
    const baseSaleMinor = moneyToMinor(input.salePrice as MoneyInput);
    effectiveMinor = Number(roundRatio(BigInt(normalMinor) * BigInt(baseSaleMinor), BigInt(baseNormalMinor)));
    effectiveMinor = Math.max(1, Math.min(normalMinor - 1, effectiveMinor));
  }
  const discountMinor = normalMinor - effectiveMinor;

  return {
    normalPrice: minorToMoney(normalMinor),
    effectivePrice: minorToMoney(effectiveMinor),
    discountAmount: minorToMoney(discountMinor),
    discountPercentage: discountMinor > 0
      ? Number(roundRatio(BigInt(discountMinor) * 10_000n, BigInt(normalMinor))) / 100
      : 0,
    isOnSale: status === "ACTIVE",
    status,
  };
}
