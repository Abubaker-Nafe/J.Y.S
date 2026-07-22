import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { removeWishlistItem } from "@/lib/domain/wishlist-service";
import { assertSameOrigin, jsonError } from "@/lib/security/request";

type RouteContext = { params: Promise<{ productId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const { productId } = await context.params;
    return NextResponse.json({ items: await removeWishlistItem(session.user.id, productId) });
  } catch (error) {
    return jsonError(error);
  }
}

