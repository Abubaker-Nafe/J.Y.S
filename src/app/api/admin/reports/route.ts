import { adminActor, adminOk, handleAdminError } from "@/lib/admin/api";
import { reportQuerySchema } from "@/lib/admin/schemas";
import { getReportData } from "@/lib/reports/service";

export async function GET(request: Request) { try { await adminActor(); const query = Object.fromEntries(new URL(request.url).searchParams); const filters = reportQuerySchema.parse(query); return adminOk(await getReportData(filters)); } catch (error) { return handleAdminError(error); } }
