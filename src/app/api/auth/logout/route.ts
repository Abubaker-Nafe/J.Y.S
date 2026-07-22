import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, jsonError } from "@/lib/security/request";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSessionCookie();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}

