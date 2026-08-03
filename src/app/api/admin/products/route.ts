import { adminActor, adminOk, handleAdminError, parseAdminJson } from "@/lib/admin/api";
import { createProduct } from "@/lib/admin/mutations";
import { listProducts } from "@/lib/admin/repository";
import { productMutationSchema } from "@/lib/admin/schemas";
import { revalidatePath } from "next/cache";

export async function GET(request: Request) {
  try {
    await adminActor();
    const query = new URL(request.url).searchParams;
    const data = await listProducts({ page: Number(query.get("page") || 1), search: query.get("search") ?? undefined, status: query.get("status") ?? undefined, categoryId: query.get("category") ?? undefined, availability: query.get("availability") ?? undefined, stockState: query.get("stock") ?? undefined, saleState: query.get("sale") ?? undefined });
    return adminOk(data);
  } catch (error) { return handleAdminError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await adminActor(request);
    const input = await parseAdminJson(request, productMutationSchema);
    const product = await createProduct(input, actor.id);
    revalidatePath("/", "layout");
    return adminOk(product, { status: 201, message: "Product created." });
  } catch (error) { return handleAdminError(error); }
}
