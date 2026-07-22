import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth/service";
import { clearSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const rate = checkRateLimit(`reset-password:${getClientIp(request)}`, {
      limit: 8,
      windowMs: 60 * 60 * 1_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: "Too many reset attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const input = parseWithSchema(resetPasswordSchema, await parseJsonBody(request));
    await resetPassword(input.token, input.password);
    await clearSessionCookie();
    return NextResponse.json({ message: "Password updated. Please sign in again." });
  } catch (error) {
    return jsonError(error);
  }
}

