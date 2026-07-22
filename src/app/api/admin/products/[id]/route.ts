import { adminActor, adminOk, handleAdminError, parseAdminId, parseAdminJson } from "@/lib/admin/api";
import { setProductArchived, updateProduct } from "@/lib/admin/mutations";
import { getProduct } from "@/lib/admin/repository";
import { productMutationSchema } from "@/lib/admin/schemas";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try {
    await adminActor();
    const id = parseAdminId((await context.params).id);
    const product = await getProduct(id);
    return product ? adminOk(product) : Response.json({ ok: false, error: "Product not found." }, { status: 404 });
  } catch (error) { return handleAdminError(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await adminActor(request);
    const id = parseAdminId((await context.params).id);
    const input = await parseAdminJson(request, productMutationSchema);
    return adminOk(await updateProduct(id, input, actor.id), { message: "Product updated." });
  } catch (error) { return handleAdminError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const actor = await adminActor(request);
    const id = parseAdminId((await context.params).id);
    return adminOk(await setProductArchived(id, true, actor.id), { message: "Product archived." });
  } catch (error) { return handleAdminError(error); }
}
