import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { addWishlistItem, getWishlist } from "@/lib/domain/wishlist-service";
import { assertSameOrigin, jsonError } from "@/lib/security/request";
import { wishlistMutationSchema } from "@/lib/validation/commerce";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireUser();
    return NextResponse.json({ items: await getWishlist(session.user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const input = parseWithSchema(wishlistMutationSchema, await parseJsonBody(request));
    return NextResponse.json(
      { items: await addWishlistItem(session.user.id, input.productId) },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}

