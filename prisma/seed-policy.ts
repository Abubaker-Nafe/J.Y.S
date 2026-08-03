export const DEFAULT_SEED_CREDENTIALS = {
  adminEmail: "admin@jys.local",
  adminPassword: "ChangeMe-Admin-2026!",
  customerEmail: "customer@jys.local",
  customerPassword: "ChangeMe-Customer-2026!",
} as const;

interface SeedCredentialPolicyInput {
  nodeEnv?: string;
  appUrl?: string;
  adminEmail: string;
  adminPassword: string;
  customerEmail: string;
  customerPassword: string;
}

function isHttpsOrigin(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Public sample credentials are convenient locally, but must never be written
 * into a database reached by a production-like seed invocation.
 */
export function assertSafeSeedCredentials(input: SeedCredentialPolicyInput) {
  const productionLike = input.nodeEnv === "production" || isHttpsOrigin(input.appUrl);
  if (!productionLike) return;

  const unsafeVariables = [
    input.adminEmail === DEFAULT_SEED_CREDENTIALS.adminEmail ? "SEED_ADMIN_EMAIL" : null,
    input.adminPassword === DEFAULT_SEED_CREDENTIALS.adminPassword ? "SEED_ADMIN_PASSWORD" : null,
    input.customerEmail === DEFAULT_SEED_CREDENTIALS.customerEmail ? "SEED_CUSTOMER_EMAIL" : null,
    input.customerPassword === DEFAULT_SEED_CREDENTIALS.customerPassword ? "SEED_CUSTOMER_PASSWORD" : null,
  ].filter((value): value is string => value !== null);

  if (unsafeVariables.length) {
    throw new Error(
      `Refusing to seed public development credentials into a production-like environment. Replace: ${unsafeVariables.join(", ")}.`,
    );
  }
}

interface SeedProductMetadata {
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: string;
  lowStockThreshold: number;
  isFeatured: boolean;
}

/** Existing catalog rows receive descriptive metadata only; operational state is preserved. */
export function existingSeedProductUpdate(product: SeedProductMetadata) {
  return {
    categoryId: product.categoryId,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    descriptionAr: product.descriptionAr,
    descriptionEn: product.descriptionEn,
    price: product.price,
    lowStockThreshold: product.lowStockThreshold,
    isFeatured: product.isFeatured,
  };
}

interface SeedVariantMetadata<TAttributes> {
  sku: string;
  labelAr: string;
  labelEn: string;
  priceOverride: string | null;
  attributes: TAttributes;
}

/** Existing variants receive descriptive metadata only; stock and availability are preserved. */
export function existingSeedVariantUpdate<TAttributes>(variant: SeedVariantMetadata<TAttributes>) {
  return {
    sku: variant.sku,
    labelAr: variant.labelAr,
    labelEn: variant.labelEn,
    priceOverride: variant.priceOverride,
    attributes: variant.attributes,
  };
}
