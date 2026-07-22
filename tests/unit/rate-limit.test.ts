import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "@/lib/security/rate-limit";

describe("sensitive-operation rate limiting", () => {
  beforeEach(resetRateLimitsForTests);

  it("blocks requests after the configured threshold and resets after the window", () => {
    expect(checkRateLimit("login:user", { limit: 2, windowMs: 1_000 }, 1_000).allowed).toBe(true);
    expect(checkRateLimit("login:user", { limit: 2, windowMs: 1_000 }, 1_100).allowed).toBe(true);
    const blocked = checkRateLimit("login:user", { limit: 2, windowMs: 1_000 }, 1_200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(checkRateLimit("login:user", { limit: 2, windowMs: 1_000 }, 2_001).allowed).toBe(true);
  });
});

