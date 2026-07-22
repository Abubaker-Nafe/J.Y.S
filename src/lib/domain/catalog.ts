export type ProductAvailabilityInput = {
  status: "DRAFT" | "ACTIVE" | "HIDDEN" | "ARCHIVED";
  archivedAt: Date | null;
  stockQuantity: number;
  hasVariants: boolean;
  variant?: {
    belongsToProduct: boolean;
    isAvailable: boolean;
    stockQuantity: number;
  } | null;
};

export type AvailabilityResult =
  | { available: true; availableStock: number }
  | {
      available: false;
      availableStock: number;
      reason: "PRODUCT_UNAVAILABLE" | "VARIANT_REQUIRED" | "VARIANT_UNAVAILABLE" | "OUT_OF_STOCK";
    };

export function getProductAvailability(input: ProductAvailabilityInput): AvailabilityResult {
  if (input.status !== "ACTIVE" || input.archivedAt) {
    return { available: false, availableStock: 0, reason: "PRODUCT_UNAVAILABLE" };
  }
  if (input.hasVariants && !input.variant) {
    return { available: false, availableStock: 0, reason: "VARIANT_REQUIRED" };
  }
  if (input.variant) {
    if (!input.variant.belongsToProduct || !input.variant.isAvailable) {
      return { available: false, availableStock: 0, reason: "VARIANT_UNAVAILABLE" };
    }
    if (input.variant.stockQuantity < 1) {
      return { available: false, availableStock: 0, reason: "OUT_OF_STOCK" };
    }
    return { available: true, availableStock: input.variant.stockQuantity };
  }
  if (input.stockQuantity < 1) {
    return { available: false, availableStock: 0, reason: "OUT_OF_STOCK" };
  }
  return { available: true, availableStock: input.stockQuantity };
}

export function validateRequestedQuantity(quantity: number, availableStock: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be a positive integer");
  }
  if (quantity > availableStock) {
    throw new Error("Requested quantity exceeds available stock");
  }
}

