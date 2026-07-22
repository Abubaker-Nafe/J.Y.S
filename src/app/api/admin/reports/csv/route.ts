import { adminActor, handleAdminError } from "@/lib/admin/api";
import { getAdminLocale } from "@/lib/admin/i18n";
import { reportQuerySchema } from "@/lib/admin/schemas";
import { productReportCsv } from "@/lib/reports/csv";
import { getReportData } from "@/lib/reports/service";

export async function GET(request: Request) {
  try { await adminActor(); const query = new URL(request.url).searchParams; const filters = reportQuerySchema.parse(Object.fromEntries(query)); const locale = getAdminLocale(query.get("locale") ?? "en"); const report = await getReportData(filters); return new Response(productReportCsv(report, locale), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="jys-product-report-${report.from}-${report.to}.csv"`, "Cache-Control": "private, no-store" } }); }
  catch (error) { return handleAdminError(error); }
}
