import { describe, expect, it } from "vitest";
import { locationMutationSchema, orderMutationSchema, productMutationSchema, settingsMutationSchema } from "./schemas";

const product = {
  sku: "JYS-TEST-1",
  slug: "test-product",
  nameAr: "منتج تجريبي",
  nameEn: "Test product",
  descriptionAr: "وصف عربي واضح",
  descriptionEn: "Clear English description",
  price: 12.5,
  stock: 4,
  lowStockThreshold: 2,
  categoryId: "category-id",
  active: true,
  featured: false,
  images: [],
  variants: [],
};

describe("admin mutation validation", () => {
  it("requires both Arabic and English product content", () => {
    expect(productMutationSchema.safeParse(product).success).toBe(true);
    expect(productMutationSchema.safeParse({ ...product, nameAr: "" }).success).toBe(false);
    expect(productMutationSchema.safeParse({ ...product, descriptionEn: "" }).success).toBe(false);
  });

  it("rejects duplicate variant SKUs without case sensitivity", () => {
    const variant = { sku: "VAR-ONE", labelAr: "كبير", labelEn: "Large", priceOverride: null, stock: 2, active: true };
    const result = productMutationSchema.safeParse({ ...product, variants: [variant, { ...variant, sku: "var-one" }] });
    expect(result.success).toBe(false);
  });

  it("permits exactly one order field per status mutation", () => {
    expect(orderMutationSchema.safeParse({ status: "CONFIRMED", note: "Stock checked" }).success).toBe(true);
    expect(orderMutationSchema.safeParse({ paymentStatus: "PAID" }).success).toBe(true);
    expect(orderMutationSchema.safeParse({ status: "CONFIRMED", paymentStatus: "PAID" }).success).toBe(false);
    expect(orderMutationSchema.safeParse({}).success).toBe(false);
  });

  it("rejects negative delivery fees", () => {
    expect(locationMutationSchema.safeParse({ kind: "city", nameAr: "رام الله", nameEn: "Ramallah", slug: "ramallah", deliveryFee: -1, active: true, displayOrder: 0 }).success).toBe(false);
  });

  it("whitelists setting keys and exact nested fields", () => {
    const valid = { settings: [{ key: "commerce.currency", value: { code: "ILS", symbolAr: "₪", symbolEn: "₪" }, description: "Currency", isPublic: true }] };
    expect(settingsMutationSchema.safeParse(valid).success).toBe(true);
    expect(settingsMutationSchema.safeParse({ settings: [{ ...valid.settings[0], key: "auth.secret" }] }).success).toBe(false);
    expect(settingsMutationSchema.safeParse({ settings: [{ ...valid.settings[0], value: { ...valid.settings[0]!.value, hidden: "unexpected" } }] }).success).toBe(false);
  });
});
