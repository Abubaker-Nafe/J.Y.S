import { NextResponse } from "next/server";
import { authenticateCredentials, InvalidCredentialsError } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/security/request";
import { checkRateLimit, clearRateLimit } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "RATE_LIMITED", message: "Too many login attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = getClientIp(request);
    // This ingress bucket is deliberately evaluated before reading the body,
    // so rejected clients cannot repeatedly consume the JSON parsing budget.
    const ingressRate = checkRateLimit(`login-ingress:${ip}`, {
      limit: 60,
      windowMs: 15 * 60 * 1_000,
    });
    if (!ingressRate.allowed) return rateLimited(ingressRate.retryAfterSeconds);

    const input = parseWithSchema(loginSchema, await parseJsonBody(request));
    const key = `login:${ip}:${input.email}`;
    const rate = checkRateLimit(key, { limit: 8, windowMs: 15 * 60 * 1_000 });
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);
    const user = await authenticateCredentials(input);
    clearRateLimit(key);
    await setSessionCookie(user);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        { status: 401 },
      );
    }
    return jsonError(error);
  }
}
