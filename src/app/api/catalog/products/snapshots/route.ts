import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorefrontProductsByIds } from "@/lib/catalog/server";
import { jsonError } from "@/lib/security/request";
import { parseWithSchema } from "@/lib/validation/common";

const querySchema = z.object({
  ids: z.string().min(1).max(4096).transform((value) => value.split(",").filter(Boolean)).pipe(z.array(z.string().regex(/^[A-Za-z0-9_-]{1,100}$/)).min(1).max(48)),
}).strict();

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const input = parseWithSchema(querySchema, Object.fromEntries(new URL(request.url).searchParams));
    const catalog = await getStorefrontProductsByIds(input.ids);
    if (catalog.source === "unavailable") return NextResponse.json({ error: "CATALOG_UNAVAILABLE", message: "The requested products are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ products: catalog.products }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
