import { z } from "zod";

const AUTH_SECRET_PLACEHOLDER = "replace-with-a-random-32-byte-secret";
const DATABASE_USER_PLACEHOLDER = "JYS_USER";
const DATABASE_PASSWORD_PLACEHOLDER = "JYS_PASSWORD";
const DEFAULT_SEED_ADMIN_EMAIL = "admin@jys.local";
const DEFAULT_SEED_ADMIN_PASSWORD = "ChangeMe-Admin-2026!";

const optionalEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  APP_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  DEV_ALLOWED_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  // Additional drivers belong behind ImageStorage only after their adapter is
  // actually shipped. Do not accept configuration that cannot be fulfilled.
  IMAGE_STORAGE_DRIVER: z.literal("local").default("local"),
  MAX_IMAGE_SIZE_MB: z.coerce.number().int().positive().max(20).default(5),
});

const parsed = optionalEnvSchema.safeParse(process.env);

// Build-time code may import this module without production runtime secrets.
// Request-time gates and the readiness endpoint enforce the production-only
// requirements below before protected work is accepted.
export const env = parsed.success
  ? parsed.data
  : {
      NODE_ENV: process.env.NODE_ENV === "production" ? "production" as const : "development" as const,
      EMAIL_PROVIDER: "console" as const,
      IMAGE_STORAGE_DRIVER: "local" as const,
      MAX_IMAGE_SIZE_MB: 5,
    };

export type ProductionConfigIssue =
  | "DATABASE_URL"
  | "AUTH_SECRET"
  | "APP_URL"
  | "NEXT_PUBLIC_APP_URL"
  | "URL_ORIGIN_MISMATCH"
  | "UNSAFE_SEED_DEFAULTS"
  | "RUNTIME_OPTIONS";

function validUrl(value: string | undefined, protocols: readonly string[]): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function isUnsafeAuthSecret(value: string | undefined): boolean {
  return !value || value.length < 32 || value === AUTH_SECRET_PLACEHOLDER;
}

/**
 * Return non-sensitive issue codes for readiness checks and unit tests.
 * Development/test intentionally remain permissive so a database-independent
 * build and the demo-safe storefront can still run.
 */
export function getProductionConfigIssues(
  source: NodeJS.ProcessEnv = process.env,
): ProductionConfigIssue[] {
  if (source.NODE_ENV !== "production") return [];

  const issues = new Set<ProductionConfigIssue>();
  const databaseUrl = validUrl(source.DATABASE_URL, ["postgresql:", "postgres:"]);
  if (
    !databaseUrl ||
    source.DATABASE_URL?.includes(DATABASE_USER_PLACEHOLDER) ||
    source.DATABASE_URL?.includes(DATABASE_PASSWORD_PLACEHOLDER)
  ) {
    issues.add("DATABASE_URL");
  }

  if (isUnsafeAuthSecret(source.AUTH_SECRET)) issues.add("AUTH_SECRET");

  const appUrl = validUrl(source.APP_URL, ["https:"]);
  const publicUrl = validUrl(source.NEXT_PUBLIC_APP_URL, ["https:"]);
  if (!appUrl) issues.add("APP_URL");
  if (!publicUrl) issues.add("NEXT_PUBLIC_APP_URL");
  if (appUrl && publicUrl && appUrl.origin !== publicUrl.origin) {
    issues.add("URL_ORIGIN_MISMATCH");
  }

  if (
    source.SEED_ADMIN_EMAIL?.trim().toLowerCase() === DEFAULT_SEED_ADMIN_EMAIL ||
    source.SEED_ADMIN_PASSWORD === DEFAULT_SEED_ADMIN_PASSWORD
  ) {
    issues.add("UNSAFE_SEED_DEFAULTS");
  }

  if (!optionalEnvSchema.safeParse(source).success) issues.add("RUNTIME_OPTIONS");
  return [...issues];
}

export function assertProductionRuntimeConfig(source: NodeJS.ProcessEnv = process.env): void {
  if (getProductionConfigIssues(source).length > 0) {
    // Do not put environment values or individual failures into logs/responses.
    throw new Error("Production runtime configuration is incomplete or unsafe");
  }
}
