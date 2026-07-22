type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();
let checksSincePrune = 0;

function pruneExpired(now: number) {
  checksSincePrune += 1;
  if (checksSincePrune < 100 && buckets.size < 10_000) return;
  checksSincePrune = 0;
  for (const [key, entry] of buckets) if (entry.resetAt <= now) buckets.delete(key);
  // A shared external limiter is required for horizontal scale, but a single
  // process must still have a hard memory ceiling under adversarial key churn.
  while (buckets.size > 20_000) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now = Date.now(),
): RateLimitResult {
  pruneExpired(now);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, remaining: options.limit - current.count, retryAfterSeconds: 0 };
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
  checksSincePrune = 0;
}
