import { adminActor, adminOk, handleAdminError } from "@/lib/admin/api";
import { getImageStorage, InvalidImageError } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    await adminActor(request);
    const maxMb = Number(process.env.MAX_IMAGE_SIZE_MB ?? "5");
    const maxImageBytes = Number.isFinite(maxMb) && maxMb > 0 ? maxMb * 1_048_576 : 5 * 1_048_576;
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > maxImageBytes + 524_288) {
      return Response.json({ ok: false, error: "Upload is larger than the allowed image size." }, { status: 413 });
    }
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) return Response.json({ ok: false, error: "Choose an image to upload." }, { status: 422 });
    const image = await getImageStorage().save(file);
    return adminOk(image, { status: 201, message: "Image uploaded." });
  } catch (error) {
    if (error instanceof InvalidImageError) return Response.json({ ok: false, error: error.message }, { status: 422 });
    return handleAdminError(error);
  }
}
