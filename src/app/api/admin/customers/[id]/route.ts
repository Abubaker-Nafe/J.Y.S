import { adminActor, adminOk, handleAdminError, parseAdminId } from "@/lib/admin/api";
import { getCustomer } from "@/lib/admin/repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await adminActor(); const id = parseAdminId((await params).id); const customer = await getCustomer(id); return customer ? adminOk(customer) : Response.json({ ok: false, error: "Customer not found." }, { status: 404 }); }
  catch (error) { return handleAdminError(error); }
}
