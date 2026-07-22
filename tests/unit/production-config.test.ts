import { describe, expect, it } from "vitest";
import { getProductionConfigIssues, isUnsafeAuthSecret } from "@/lib/env";

const validProductionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://jys_app:private-password@db.internal:5432/jys?schema=public",
  AUTH_SECRET: "a-unique-production-secret-with-more-than-thirty-two-characters",
  APP_URL: "https://shop.example.com",
  NEXT_PUBLIC_APP_URL: "https://shop.example.com",
  EMAIL_PROVIDER: "resend",
  IMAGE_STORAGE_DRIVER: "local",
  MAX_IMAGE_SIZE_MB: "5",
};

describe("production runtime configuration", () => {
  it("accepts a complete production configuration", () => {
    expect(getProductionConfigIssues(validProductionEnv)).toEqual([]);
  });

  it("keeps database-independent development and build checks permissive", () => {
    expect(getProductionConfigIssues({ NODE_ENV: "development" })).toEqual([]);
    expect(getProductionConfigIssues({ NODE_ENV: "test" })).toEqual([]);
  });

  it("rejects missing, placeholder, insecure, and mismatched production values", () => {
    const issues = getProductionConfigIssues({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://JYS_USER:JYS_PASSWORD@localhost:5432/jys?schema=public",
      AUTH_SECRET: "replace-with-a-random-32-byte-secret",
      APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "https://public.example.com",
      SEED_ADMIN_EMAIL: "admin@jys.local",
      SEED_ADMIN_PASSWORD: "ChangeMe-Admin-2026!",
    });

    expect(issues).toEqual(expect.arrayContaining([
      "DATABASE_URL",
      "AUTH_SECRET",
      "APP_URL",
      "UNSAFE_SEED_DEFAULTS",
    ]));
    expect(isUnsafeAuthSecret("replace-with-a-random-32-byte-secret")).toBe(true);
  });

  it("requires server and public URLs to share an origin", () => {
    expect(getProductionConfigIssues({
      ...validProductionEnv,
      NEXT_PUBLIC_APP_URL: "https://www.example.com",
    })).toContain("URL_ORIGIN_MISMATCH");
  });
});
