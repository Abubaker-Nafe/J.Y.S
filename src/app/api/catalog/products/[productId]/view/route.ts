import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseWithSchema } from "@/lib/validation/common";
import { z } from "zod";

const paramsSchema = z.object({ productId: z.string().trim().min(3).max(64) });
const DEDUPE_WINDOW_MS = 30 * 60 * 1_000;

type Context = { params: Promise<{ productId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { productId } = parseWithSchema(paramsSchema, await params);

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ counted: false, reason: "catalog-not-configured" }, { status: 202 });
    }

    const clientKey = `${getClientIp(request)}:${request.headers.get("user-agent")?.slice(0, 256) ?? "unknown"}`;
    const limit = checkRateLimit(`product-view:${productId}:${clientKey}`, {
      limit: 5,
      windowMs: DEDUPE_WINDOW_MS,
    });
    if (!limit.allowed) return NextResponse.json({ counted: false, reason: "deduplicated" });

    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) {
      return NextResponse.json({ counted: false, reason: "analytics-not-configured" }, { status: 202 });
    }
    const fingerprint = createHash("sha256").update(`${secret}:${clientKey}`).digest("hex");
    const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS);

    const counted = await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: productId, status: "ACTIVE", archivedAt: null },
          select: { id: true },
        });
        if (!product) return false;
        const recent = await tx.productView.findFirst({
          where: { productId, fingerprint, viewedAt: { gte: cutoff } },
          select: { id: true },
        });
        if (recent) return false;
        await tx.productView.create({ data: { productId, fingerprint } });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ counted }, { status: counted ? 201 : 200 });
  } catch (error) {
    return jsonError(error);
  }
}
