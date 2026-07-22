import { adminActor, adminOk, handleAdminError, parseAdminId, parseAdminJson } from "@/lib/admin/api";
import { updateOrder } from "@/lib/admin/mutations";
import { getOrder } from "@/lib/admin/repository";
import { orderMutationSchema } from "@/lib/admin/schemas";

type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try { await adminActor(); const id = parseAdminId((await params).id); const order = await getOrder(id); return order ? adminOk(order) : Response.json({ ok: false, error: "Order not found." }, { status: 404 }); }
  catch (error) { return handleAdminError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try { const actor = await adminActor(request); const id = parseAdminId((await params).id); const input = await parseAdminJson(request, orderMutationSchema); return adminOk(await updateOrder(id, input, actor.id), { message: "Order updated." }); }
  catch (error) { return handleAdminError(error); }
}
