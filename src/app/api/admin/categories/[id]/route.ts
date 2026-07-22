import { adminActor, adminOk, handleAdminError, parseAdminId, parseAdminJson } from "@/lib/admin/api";
import { archiveCategory, updateCategory } from "@/lib/admin/mutations";
import { categoryMutationSchema } from "@/lib/admin/schemas";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try { const actor = await adminActor(request); const id = parseAdminId((await params).id); const input = await parseAdminJson(request, categoryMutationSchema); return adminOk(await updateCategory(id, input, actor.id), { message: "Category updated." }); }
  catch (error) { return handleAdminError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { const actor = await adminActor(request); const id = parseAdminId((await params).id); return adminOk(await archiveCategory(id, actor.id), { message: "Category archived." }); }
  catch (error) { return handleAdminError(error); }
}
