import "server-only";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/errors";
import { requireAdmin } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/request";
import { parseJsonBody, ValidationError } from "@/lib/validation/common";
import type { AdminActor } from "./types";

export function adminOk<T>(data: T, init?: ResponseInit & { message?: string }) {
  return NextResponse.json({ ok: true, data, ...(init?.message ? { message: init.message } : {}) }, { status: init?.status ?? 200, headers: init?.headers });
}

export function adminError(error: string, status: number, fields?: Record<string, string[]>) {
  return NextResponse.json({ ok: false, error, ...(fields ? { fields } : {}) }, { status });
}

export async function adminActor(request?: Request): Promise<AdminActor> {
  if (request && request.method !== "GET" && request.method !== "HEAD") {
    assertSameOrigin(request);
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (!contentType.includes("multipart/form-data") && Number.isFinite(contentLength) && contentLength > 1_048_576) {
      throw new AdminDomainError("Request body is too large.", 413);
    }
  }
  const session = await requireAdmin();
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
}

export function parseAdminId(value: string) {
  return adminIdSchema.parse(value);
}

const adminIdSchema = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, "Invalid record identifier");

export async function parseAdminJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const payload = await parseJsonBody(request, 1_048_576);
  return schema.parse(payload);
}

function zodFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "form";
    fields[key] = [...(fields[key] ?? []), issue.message];
  }
  return fields;
}

export function handleAdminError(error: unknown) {
  if (error instanceof AuthenticationError) return adminError("Authentication required", 401);
  if (error instanceof AuthorizationError) return adminError("Administrator permission required", 403);
  if (error instanceof ZodError) return adminError("Please correct the highlighted fields.", 422, zodFields(error));
  if (error instanceof ValidationError) return adminError(error.message, error.status);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return adminError("A record with this unique value already exists.", 409);
    if (error.code === "P2025") return adminError("The requested record was not found.", 404);
    if (error.code === "P2003") return adminError("This record is still referenced and cannot be removed.", 409);
  }
  if (error instanceof AdminDomainError) return adminError(error.message, error.status);
  console.error("Admin request failed", error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
  return adminError("The request could not be completed.", 500);
}

export class AdminDomainError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "AdminDomainError";
  }
}
