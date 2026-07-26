import { describe, expect, it } from "vitest";
import { getProductAvailability, validateRequestedQuantity } from "@/lib/domain/catalog";

const activeProduct = {
  status: "ACTIVE" as const,
  archivedAt: null,
  isAvailable: true,
  stockQuantity: 5,
  hasVariants: false,
};

describe("product availability", () => {
  it("allows an active in-stock product", () => {
    expect(getProductAvailability(activeProduct)).toEqual({ available: true, availableStock: 5 });
  });

  it("requires a variation when variations exist", () => {
    expect(getProductAvailability({ ...activeProduct, hasVariants: true })).toMatchObject({
      available: false,
      reason: "VARIANT_REQUIRED",
    });
  });

  it("rejects hidden, archived, and unavailable variants", () => {
    expect(getProductAvailability({ ...activeProduct, status: "HIDDEN" })).toMatchObject({
      available: false,
      reason: "PRODUCT_UNAVAILABLE",
    });
    expect(
      getProductAvailability({
        ...activeProduct,
        hasVariants: true,
        variant: { belongsToProduct: true, isActive: true, isAvailable: false, stockQuantity: 4 },
      }),
    ).toMatchObject({ available: false, reason: "VARIANT_UNAVAILABLE" });
    expect(getProductAvailability({ ...activeProduct, isAvailable: false })).toMatchObject({
      available: false,
      reason: "PRODUCT_UNAVAILABLE",
    });
    expect(getProductAvailability({
      ...activeProduct,
      hasVariants: true,
      variant: { belongsToProduct: true, isActive: false, isAvailable: true, stockQuantity: 4 },
    })).toMatchObject({ available: false, reason: "VARIANT_UNAVAILABLE" });
  });

  it("enforces positive integer quantities and stock limits", () => {
    expect(() => validateRequestedQuantity(5, 5)).not.toThrow();
    expect(() => validateRequestedQuantity(6, 5)).toThrow("exceeds available stock");
    expect(() => validateRequestedQuantity(1.5, 5)).toThrow("positive integer");
  });
});

