import { describe, expect, it } from "vitest";
import { postAuthDestination } from "@/lib/auth/navigation";

describe("postAuthDestination", () => {
  it("sends an administrator to the dashboard after a normal login", () => {
    expect(postAuthDestination("en", "ADMIN")).toBe("/en/admin");
  });

  it("sends a customer to their account after a normal login", () => {
    expect(postAuthDestination("en", "CUSTOMER")).toBe("/en/profile");
  });

  it("preserves an admin destination for an administrator", () => {
    expect(postAuthDestination("en", "ADMIN", "/en/admin/reports")).toBe("/en/admin/reports");
  });

  it("does not send a customer to an admin destination", () => {
    expect(postAuthDestination("en", "CUSTOMER", "/en/admin/orders")).toBe("/en/profile");
  });

  it("preserves a valid customer destination", () => {
    expect(postAuthDestination("ar", "CUSTOMER", "/ar/checkout")).toBe("/ar/checkout");
  });

  it("rejects cross-locale and external destinations", () => {
    expect(postAuthDestination("en", "CUSTOMER", "/ar/profile")).toBe("/en/profile");
    expect(postAuthDestination("en", "ADMIN", "https://example.com")).toBe("/en/admin");
  });
});
