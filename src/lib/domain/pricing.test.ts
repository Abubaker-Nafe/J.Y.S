import { describe, expect, it } from "vitest";
import { percentageFromSalePrice, resolveSalePricing, salePriceFromPercentage, validateSaleConfiguration } from "./pricing";

describe("sale pricing", () => {
  const active = {
    normalPrice: "100.00",
    isOnSale: true,
    salePrice: "80.00",
    saleStartsAt: "2026-07-01T00:00:00.000Z",
    saleEndsAt: "2026-09-01T00:00:00.000Z",
  };

  it("resolves active, scheduled and expired windows without floating point arithmetic", () => {
    expect(resolveSalePricing(active, null, new Date("2026-08-01T00:00:00.000Z"))).toMatchObject({ effectivePrice: "80.00", discountPercentage: 20, status: "ACTIVE" });
    expect(resolveSalePricing(active, null, new Date("2026-06-01T00:00:00.000Z"))).toMatchObject({ effectivePrice: "100.00", status: "SCHEDULED" });
    expect(resolveSalePricing(active, null, new Date("2026-10-01T00:00:00.000Z"))).toMatchObject({ effectivePrice: "100.00", status: "EXPIRED" });
  });

  it("applies the base discount ratio to variant overrides with cent rounding", () => {
    expect(resolveSalePricing(active, "119.99", new Date("2026-08-01T00:00:00.000Z"))).toMatchObject({ normalPrice: "119.99", effectivePrice: "95.99", isOnSale: true });
  });

  it("converts percentage input into the canonical sale price", () => {
    expect(salePriceFromPercentage("199.99", "15")).toBe("169.99");
    expect(percentageFromSalePrice("199.99", "169.99")).toBe(15);
  });

  it("rejects invalid prices and date windows", () => {
    expect(validateSaleConfiguration({ ...active, salePrice: "100.00" })).toContain("SALE_PRICE_BELOW_NORMAL");
    expect(validateSaleConfiguration({ ...active, saleStartsAt: active.saleEndsAt, saleEndsAt: active.saleStartsAt })).toContain("SALE_WINDOW_INVALID");
  });

  it("does not activate a sale for hidden or archived products", () => {
    expect(resolveSalePricing({ ...active, productActive: false }, null, new Date("2026-08-01T00:00:00.000Z")).isOnSale).toBe(false);
    expect(resolveSalePricing({ ...active, archived: true }, null, new Date("2026-08-01T00:00:00.000Z")).isOnSale).toBe(false);
  });
});
