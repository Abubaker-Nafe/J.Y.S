import { adminActor, adminOk, handleAdminError, parseAdminId } from "@/lib/admin/api";
import { setProductArchived } from "@/lib/admin/mutations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await adminActor(request);
    const id = parseAdminId((await params).id);
    return adminOk(await setProductArchived(id, false, actor.id), { message: "Product restored as hidden." });
  } catch (error) { return handleAdminError(error); }
}
