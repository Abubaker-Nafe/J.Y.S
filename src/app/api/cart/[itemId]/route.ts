import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { removeCartItem, updateCartItem } from "@/lib/domain/cart-service";
import { assertSameOrigin, jsonError } from "@/lib/security/request";
import { updateCartItemSchema } from "@/lib/validation/commerce";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const { itemId } = await context.params;
    const input = parseWithSchema(updateCartItemSchema, await parseJsonBody(request));
    return NextResponse.json({ cart: await updateCartItem(session.user.id, itemId, input.quantity) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const { itemId } = await context.params;
    return NextResponse.json({ cart: await removeCartItem(session.user.id, itemId) });
  } catch (error) {
    return jsonError(error);
  }
}

