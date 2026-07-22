import { NextResponse } from "next/server";
import { registerCustomer } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { registerSchema } from "@/lib/validation/auth";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const rate = checkRateLimit(`register:${getClientIp(request)}`, {
      limit: 5,
      windowMs: 60 * 60 * 1_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: "Too many registration attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const input = parseWithSchema(registerSchema, await parseJsonBody(request));
    const user = await registerCustomer(input);
    await setSessionCookie(user);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

