import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createOrderFromCart } from "@/lib/domain/order-service";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { checkoutSchema } from "@/lib/validation/commerce";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const rate = checkRateLimit(`checkout:${session.user.id}:${getClientIp(request)}`, {
      limit: 8,
      windowMs: 10 * 60 * 1_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: "Too many checkout attempts. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const input = parseWithSchema(checkoutSchema, await parseJsonBody(request));
    const order = await createOrderFromCart(session.user.id, input);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

