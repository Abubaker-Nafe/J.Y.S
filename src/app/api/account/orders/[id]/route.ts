import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getCustomerOrder } from "@/lib/domain/order-service";
import { jsonError } from "@/lib/security/request";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireUser();
    const { id } = await context.params;
    const order = await getCustomerOrder(session.user.id, id);
    if (!order) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Order was not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (error) {
    return jsonError(error);
  }
}

