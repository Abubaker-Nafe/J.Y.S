import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getCustomerOrders } from "@/lib/domain/order-service";
import { jsonError } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireUser();
    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "20", 10);
    return NextResponse.json(await getCustomerOrders(session.user.id, page, pageSize));
  } catch (error) {
    return jsonError(error);
  }
}

