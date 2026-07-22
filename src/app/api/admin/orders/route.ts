import { adminActor, adminOk, handleAdminError } from "@/lib/admin/api";
import { listOrders } from "@/lib/admin/repository";

export async function GET(request: Request) {
  try {
    await adminActor();
    const query = new URL(request.url).searchParams;
    return adminOk(await listOrders({ page: Number(query.get("page") || 1), search: query.get("search") ?? undefined, status: query.get("status") ?? undefined, paymentStatus: query.get("paymentStatus") ?? undefined, fulfillment: query.get("fulfillment") ?? undefined, from: query.get("from") ?? undefined, to: query.get("to") ?? undefined }));
  } catch (error) { return handleAdminError(error); }
}
