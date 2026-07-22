import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { bilingualRequiredSchema, normalizePalestinianPhone } from "@/lib/validation/common";
import { checkoutSchema } from "@/lib/validation/commerce";

describe("authentication validation", () => {
  const registration = {
    name: "Ahmad Khalil",
    email: " AHMAD@EXAMPLE.COM ",
    phone: "059-123-4567",
    password: "SecurePass2026",
    cityId: "city_ramallah",
    addressLine: "Main street, building 12",
    preferredLocale: "ar" as const,
  };

  it("normalizes email and Palestinian phone values", () => {
    const result = registerSchema.parse(registration);
    expect(result.email).toBe("ahmad@example.com");
    expect(result.phone).toBe("+970591234567");
    expect(normalizePalestinianPhone("00970 56 123 4567")).toBe("+970561234567");
  });

  it("rejects weak authentication details", () => {
    expect(registerSchema.safeParse({ ...registration, password: "password" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, password: "Short1Aa" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, password: "NOLOWERCASE2026" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, password: "nouppercase2026" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, password: "NoNumberHere" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, phone: "123" }).success).toBe(false);
  });

  it("does not apply the new-password strength policy to login", () => {
    expect(loginSchema.safeParse({ email: "legacy@example.com", password: "oldpass" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "legacy@example.com", password: "" }).success).toBe(false);
  });
});

describe("bilingual and checkout validation", () => {
  it("requires both Arabic and English managed content", () => {
    expect(bilingualRequiredSchema.safeParse({ ar: "منتج", en: "Product" }).success).toBe(true);
    expect(bilingualRequiredSchema.safeParse({ ar: "", en: "Product" }).success).toBe(false);
  });

  it("requires address fields for delivery and policy acceptance for all orders", () => {
    const base = { name: "Ahmad", phone: "0591234567", acceptPolicies: true as const };
    expect(
      checkoutSchema.safeParse({
        ...base,
        fulfillmentMethod: "DELIVERY",
        cityId: "city_ramallah",
        addressLine: "Building 12, Main Street",
      }).success,
    ).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, fulfillmentMethod: "DELIVERY" }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, acceptPolicies: false, fulfillmentMethod: "PICKUP" }).success,
    ).toBe(false);
  });
});
