import { adminActor, adminOk, handleAdminError, parseAdminJson } from "@/lib/admin/api";
import { adjustInventory } from "@/lib/admin/mutations";
import { listInventory } from "@/lib/admin/repository";
import { inventoryAdjustmentSchema } from "@/lib/admin/schemas";

export async function GET(request: Request) {
  try { await adminActor(); return adminOk(await listInventory(new URL(request.url).searchParams.get("search") ?? undefined)); }
  catch (error) { return handleAdminError(error); }
}
export async function POST(request: Request) {
  try { const actor = await adminActor(request); const input = await parseAdminJson(request, inventoryAdjustmentSchema); return adminOk(await adjustInventory(input, actor.id), { status: 201, message: "Inventory adjusted." }); }
  catch (error) { return handleAdminError(error); }
}
