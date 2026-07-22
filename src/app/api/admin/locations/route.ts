import { adminActor, adminOk, handleAdminError, parseAdminJson } from "@/lib/admin/api";
import { saveLocation } from "@/lib/admin/mutations";
import { listLocations } from "@/lib/admin/repository";
import { locationMutationSchema } from "@/lib/admin/schemas";

export async function GET() {
  try { await adminActor(); return adminOk(await listLocations()); }
  catch (error) { return handleAdminError(error); }
}
export async function POST(request: Request) {
  try { const actor = await adminActor(request); const input = await parseAdminJson(request, locationMutationSchema); return adminOk(await saveLocation(null, input, actor.id), { status: 201, message: "Location created." }); }
  catch (error) { return handleAdminError(error); }
}
