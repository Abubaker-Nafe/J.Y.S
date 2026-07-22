import { adminActor, adminOk, handleAdminError, parseAdminJson } from "@/lib/admin/api";
import { createCategory } from "@/lib/admin/mutations";
import { listCategories } from "@/lib/admin/repository";
import { categoryMutationSchema } from "@/lib/admin/schemas";

export async function GET() {
  try { await adminActor(); return adminOk(await listCategories(true)); }
  catch (error) { return handleAdminError(error); }
}

export async function POST(request: Request) {
  try { const actor = await adminActor(request); const input = await parseAdminJson(request, categoryMutationSchema); return adminOk(await createCategory(input, actor.id), { status: 201, message: "Category created." }); }
  catch (error) { return handleAdminError(error); }
}
