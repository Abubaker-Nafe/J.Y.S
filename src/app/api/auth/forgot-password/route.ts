import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/service";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

const GENERIC_MESSAGE = "If an account exists, password-reset instructions will be sent.";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = parseWithSchema(forgotPasswordSchema, await parseJsonBody(request));
    const ip = getClientIp(request);
    const rate = checkRateLimit(`forgot-password:${ip}`, {
      limit: 5,
      windowMs: 60 * 60 * 1_000,
    });
    if (rate.allowed) await requestPasswordReset(input.email, ip);
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}

