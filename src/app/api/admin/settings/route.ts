import { adminActor, adminOk, handleAdminError, parseAdminJson } from "@/lib/admin/api";
import { saveSettings } from "@/lib/admin/mutations";
import { listSettings } from "@/lib/admin/repository";
import { settingsMutationSchema } from "@/lib/admin/schemas";

export async function GET() {
  try { await adminActor(); return adminOk(await listSettings()); }
  catch (error) { return handleAdminError(error); }
}
export async function PATCH(request: Request) {
  try { const actor = await adminActor(request); const input = await parseAdminJson(request, settingsMutationSchema); return adminOk(await saveSettings(input, actor.id), { message: "Settings saved." }); }
  catch (error) { return handleAdminError(error); }
}
