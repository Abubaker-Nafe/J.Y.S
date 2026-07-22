import { adminActor, adminOk, handleAdminError, parseAdminJson } from "@/lib/admin/api";
import { saveContent } from "@/lib/admin/mutations";
import { listContent } from "@/lib/admin/repository";
import { contentMutationSchema } from "@/lib/admin/schemas";

export async function GET() {
  try { await adminActor(); return adminOk(await listContent()); }
  catch (error) { return handleAdminError(error); }
}
export async function PATCH(request: Request) {
  try { const actor = await adminActor(request); const input = await parseAdminJson(request, contentMutationSchema); return adminOk(await saveContent(input, actor.id), { message: "Content saved." }); }
  catch (error) { return handleAdminError(error); }
}
