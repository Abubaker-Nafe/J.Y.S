import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import type { ImageStorage, StoredImage } from "./types";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

function detectMimeType(bytes: Uint8Array): keyof typeof MIME_EXTENSIONS | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif")) return "image/avif";
  return null;
}

export async function validateImageFile(file: File): Promise<{
  bytes: Uint8Array;
  mimeType: keyof typeof MIME_EXTENSIONS;
}> {
  const maxMb = env.MAX_IMAGE_SIZE_MB;
  const maxBytes = Number.isFinite(maxMb) && maxMb > 0 ? maxMb * 1_048_576 : 5 * 1_048_576;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new InvalidImageError(`Image must be smaller than ${Math.floor(maxBytes / 1_048_576)} MB`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectMimeType(bytes);
  if (!mimeType || !MIME_EXTENSIONS[mimeType]) {
    throw new InvalidImageError("Only JPEG, PNG, WebP, and AVIF images are accepted");
  }
  return { bytes, mimeType };
}

class LocalImageStorage implements ImageStorage {
  private readonly root: string;

  constructor() {
    // Uploads are runtime data, never build inputs. The tracing hint prevents
    // Next from pulling the whole repository into this route's file manifest.
    this.root = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");
  }

  async save(file: File): Promise<StoredImage> {
    const { bytes, mimeType } = await validateImageFile(file);
    const filename = `${randomUUID()}.${MIME_EXTENSIONS[mimeType]}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(path.join(this.root, filename), bytes, { flag: "wx" });
    return {
      storageKey: filename,
      url: `/uploads/${filename}`,
      mimeType,
      sizeBytes: bytes.byteLength,
    };
  }

  async remove(storageKey: string): Promise<void> {
    if (!/^[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(storageKey)) {
      throw new InvalidImageError("Invalid storage key");
    }
    try {
      await unlink(path.join(this.root, storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export function getImageStorage(): ImageStorage {
  // The interface is intentionally replaceable. At present only the local,
  // persistent-volume adapter is implemented, so unsupported values fail in
  // environment validation instead of being advertised as operational.
  const configuredDriver = process.env.IMAGE_STORAGE_DRIVER ?? env.IMAGE_STORAGE_DRIVER;
  if (configuredDriver !== "local") throw new Error(`Unsupported image storage driver: ${configuredDriver}`);
  return new LocalImageStorage();
}

export type { ImageStorage, StoredImage } from "./types";
