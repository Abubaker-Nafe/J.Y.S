import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { addCartItem, getCart } from "@/lib/domain/cart-service";
import { assertSameOrigin, jsonError } from "@/lib/security/request";
import { addCartItemSchema } from "@/lib/validation/commerce";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireUser();
    return NextResponse.json({ cart: await getCart(session.user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const input = parseWithSchema(addCartItemSchema, await parseJsonBody(request));
    return NextResponse.json({ cart: await addCartItem(session.user.id, input) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

