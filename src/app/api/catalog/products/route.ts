import { NextResponse } from "next/server";
import { getStorefrontProductsPage } from "@/lib/catalog/server";
import { normalizeCatalogSort } from "@/lib/catalog/query";
import { jsonError } from "@/lib/security/request";
import { parseWithSchema } from "@/lib/validation/common";
import { z } from "zod";

const querySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(24),
    q: z.string().trim().max(100).default(""),
    category: z.string().trim().max(100).default(""),
    available: z.enum(["true", "false"]).optional(),
    sort: z.enum(["featured", "newest", "low", "high", "price-asc", "price-desc"]).default("featured"),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const input = parseWithSchema(querySchema, query);
    const catalog = await getStorefrontProductsPage({
      page: input.page,
      pageSize: input.pageSize,
      q: input.q,
      category: input.category,
      available: input.available === "true",
      sort: normalizeCatalogSort(input.sort),
    });
    if (catalog.source === "unavailable") {
      return NextResponse.json(
        { error: "CATALOG_UNAVAILABLE", message: "The product catalog is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { products: catalog.products, categories: catalog.categories, pagination: catalog.pagination },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
