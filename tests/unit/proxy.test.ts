import { describe, expect, it } from "vitest";
import { isProxyExcludedPath } from "@/proxy";

describe("locale proxy exclusions", () => {
  it.each([
    "/api/auth/session",
    "/_next/static/chunks/app.js",
    "/favicon.ico",
    "/static/manifest.json",
    "/images/jys-hero.png",
    "/uploads/product.webp",
    "/icon.svg",
  ])("does not intercept %s", (pathname) => {
    expect(isProxyExcludedPath(pathname)).toBe(true);
  });

  it.each(["/", "/profile", "/ar/profile", "/en/admin"])("keeps locale routes in scope: %s", (pathname) => {
    expect(isProxyExcludedPath(pathname)).toBe(false);
  });
});
