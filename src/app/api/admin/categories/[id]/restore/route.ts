import { adminActor, adminOk, handleAdminError, parseAdminId } from "@/lib/admin/api";
import { restoreCategory } from "@/lib/admin/mutations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const actor = await adminActor(request); const id = parseAdminId((await params).id); return adminOk(await restoreCategory(id, actor.id), { message: "Category restored as inactive." }); }
  catch (error) { return handleAdminError(error); }
}
