import { adminActor, adminOk, handleAdminError } from "@/lib/admin/api";
import { listCustomers } from "@/lib/admin/repository";

export async function GET(request: Request) {
  try { await adminActor(); const query = new URL(request.url).searchParams; return adminOk(await listCustomers({ page: Number(query.get("page") || 1), search: query.get("search") ?? undefined })); }
  catch (error) { return handleAdminError(error); }
}
