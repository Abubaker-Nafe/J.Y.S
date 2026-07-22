import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/errors";
import { assertProductionRuntimeConfig } from "@/lib/env";
import { ValidationError } from "@/lib/validation/common";

export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded.slice(0, 64);
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp.slice(0, 64);
  }
  return "unknown";
}

export function assertSameOrigin(request: Request): void {
  if (process.env.NODE_ENV !== "production") return;
  assertProductionRuntimeConfig();
  const origin = request.headers.get("origin");
  const configuredUrl = process.env.APP_URL;
  if (!configuredUrl) throw new AuthorizationError("Application origin is not configured");

  if (!origin) {
    if (request.headers.get("sec-fetch-site") === "same-origin") return;
    throw new AuthorizationError("Request origin is required");
  }

  try {
    if (new URL(configuredUrl).origin === new URL(origin).origin) return;
  } catch {
    throw new AuthorizationError("Request origin is not allowed");
  }

  throw new AuthorizationError("Request origin is not allowed");
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: error.message,
        issues: error.issues?.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: error.status },
    );
  }

  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: "AUTHENTICATION_REQUIRED", message: error.message },
      { status: 401 },
    );
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: error.message },
      { status: 403 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "CONFLICT", message: "A record with these details already exists" },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "The requested record was not found" },
        { status: 404 },
      );
    }
  }

  console.error("Unhandled API error", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
