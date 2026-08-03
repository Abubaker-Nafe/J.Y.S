import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED_CREDENTIALS,
  assertSafeSeedCredentials,
  existingSeedProductUpdate,
  existingSeedVariantUpdate,
} from "../../prisma/seed-policy";

const secureCredentials = {
  adminEmail: "owner@example.com",
  adminPassword: "Unique-Admin-2026!",
  customerEmail: "buyer@example.com",
  customerPassword: "Unique-Buyer-2026!",
};

describe("development seed safety policy", () => {
  it("allows deterministic public samples only for local development", () => {
    expect(() => assertSafeSeedCredentials({
      nodeEnv: "development",
      appUrl: "http://localhost:3000",
      ...DEFAULT_SEED_CREDENTIALS,
    })).not.toThrow();
  });

  it.each([
    { nodeEnv: "production", appUrl: "http://localhost:3000" },
    { nodeEnv: "development", appUrl: "https://shop.example.com" },
  ])("rejects public samples in a production-like invocation", (environment) => {
    expect(() => assertSafeSeedCredentials({ ...environment, ...DEFAULT_SEED_CREDENTIALS }))
      .toThrow(/SEED_ADMIN_EMAIL.*SEED_ADMIN_PASSWORD.*SEED_CUSTOMER_EMAIL.*SEED_CUSTOMER_PASSWORD/);
  });

  it("accepts unique credentials in production", () => {
    expect(() => assertSafeSeedCredentials({
      nodeEnv: "production",
      appUrl: "https://shop.example.com",
      ...secureCredentials,
    })).not.toThrow();
  });

  it("omits product and variant operational state from repeat-seed updates", () => {
    const product = existingSeedProductUpdate({
      categoryId: "category",
      nameAr: "منتج",
      nameEn: "Product",
      descriptionAr: "وصف",
      descriptionEn: "Description",
      price: "10.00",
      lowStockThreshold: 2,
      isFeatured: true,
    });
    const variant = existingSeedVariantUpdate({
      sku: "SKU-1",
      labelAr: "أسود",
      labelEn: "Black",
      priceOverride: null,
      attributes: { color: "black" },
    });

    expect(product).not.toHaveProperty("stockQuantity");
    expect(product).not.toHaveProperty("slug");
    expect(product).not.toHaveProperty("status");
    expect(product).not.toHaveProperty("archivedAt");
    expect(variant).not.toHaveProperty("stockQuantity");
    expect(variant).not.toHaveProperty("isAvailable");
  });
});
