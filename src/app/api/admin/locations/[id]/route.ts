import { adminActor, adminOk, handleAdminError, parseAdminId, parseAdminJson } from "@/lib/admin/api";
import { saveLocation } from "@/lib/admin/mutations";
import { locationMutationSchema } from "@/lib/admin/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const actor = await adminActor(request); const id = parseAdminId((await params).id); const input = await parseAdminJson(request, locationMutationSchema); return adminOk(await saveLocation(id, input, actor.id), { message: "Location updated." }); }
  catch (error) { return handleAdminError(error); }
}
