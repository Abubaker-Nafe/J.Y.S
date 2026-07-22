import { z } from "zod";

export const localeSchema = z.enum(["ar", "en"]);

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254)
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

export function normalizePalestinianPhone(value: string): string | null {
  let digits = value.replace(/[^\d]/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (/^0?5[69]\d{7}$/.test(digits)) {
    return `+970${digits.replace(/^0/, "")}`;
  }

  if (/^9705[69]\d{7}$/.test(digits) || /^9725[69]\d{7}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

export const palestinianPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine((value) => normalizePalestinianPhone(value) !== null, {
    message: "Enter a valid Palestinian mobile number",
  })
  .transform((value) => normalizePalestinianPhone(value) as string);

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/\d/, "Password must include a number");

export const idSchema = z.string().trim().min(1).max(64);

export const bilingualRequiredSchema = z
  .object({
    ar: z.string().trim().min(1, "Arabic content is required").max(10_000),
    en: z.string().trim().min(1, "English content is required").max(10_000),
  })
  .strict();

export const bilingualOptionalSchema = z
  .object({
    ar: z.string().trim().max(10_000).optional().default(""),
    en: z.string().trim().max(10_000).optional().default(""),
  })
  .strict()
  .refine((value) => value.ar.length > 0 || value.en.length > 0, {
    message: "Arabic or English content is required",
  });

export const DEFAULT_JSON_BODY_LIMIT_BYTES = 64 * 1_024;

function declaredContentLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new ValidationError("Content-Length must be a valid byte count");
  const length = Number(value);
  if (!Number.isSafeInteger(length)) throw new ValidationError("Content-Length must be a valid byte count");
  return length;
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("JSON request body exceeds the configured limit");
        throw new ValidationError("Request body is too large", undefined, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function parseJsonBody(
  request: Request,
  maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new ValidationError("Content-Type must be application/json");
  }

  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("JSON body limit must be a positive safe integer");
  }

  const contentLength = declaredContentLength(request);
  if (contentLength !== null && contentLength > maxBytes) {
    throw new ValidationError("Request body is too large", undefined, 413);
  }

  try {
    const bytes = await readBoundedBody(request, maxBytes);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("Request body must be valid JSON");
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly issues?: z.core.$ZodIssue[],
    readonly status = 400,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.issues);
  }
  return result.data;
}
