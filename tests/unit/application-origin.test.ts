import { describe, expect, it } from "vitest";
import { resolveApplicationOrigin } from "@/lib/auth/application-origin";

describe("resolveApplicationOrigin", () => {
  it("uses the current request host for local development links", () => {
    expect(resolveApplicationOrigin("http://jys.com:3000/api/auth/forgot-password", {
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
    })).toBe("http://jys.com:3000");
  });

  it("uses the configured HTTPS origin in production", () => {
    expect(resolveApplicationOrigin("http://untrusted.invalid/api/auth/forgot-password", {
      NODE_ENV: "production",
      APP_URL: "https://shop.example.com/path",
    })).toBe("https://shop.example.com");
  });
});
