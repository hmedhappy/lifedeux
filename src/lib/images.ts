import "server-only";
import { db } from "./db";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_PATH_PREFIX = "/api/images/";

/** A photo reference is either an https URL or an image uploaded to the platform. */
export function isPhotoRef(value: string): boolean {
  return /^https:\/\/\S+$/.test(value) || /^\/api\/images\/[a-z0-9]+$/.test(value);
}

function isImageFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && value.size > 0;
}

/** Checks the magic bytes so a renamed file cannot pass as an image. */
export function sniff(bytes: Uint8Array): (typeof IMAGE_TYPES)[number] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type UploadResult = { paths: string[] } | { error: "errors.imageInvalid" | "errors.imageTooLarge" };

/** Stores the uploaded files of `field` and returns their public paths. */
export async function saveUploadedImages(
  formData: FormData,
  field: string,
  max = 10,
  options: { private?: boolean; consultationId?: string; types?: readonly string[] } = {},
): Promise<UploadResult> {
  const files = formData.getAll(field).filter(isImageFile).slice(0, max);
  const prepared: { mime: string; data: Uint8Array<ArrayBuffer> }[] = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) return { error: "errors.imageTooLarge" };
    const data = new Uint8Array(await file.arrayBuffer());
    const mime = sniff(data);
    if (!mime || (options.types && !options.types.includes(mime))) return { error: "errors.imageInvalid" };
    prepared.push({ mime, data });
  }
  const paths: string[] = [];
  for (const image of prepared) {
    const saved = await db.image.create({
      data: {
        mime: image.mime,
        size: image.data.byteLength,
        data: image.data,
        private: options.private ?? false,
        consultationId: options.consultationId,
      },
      select: { id: true },
    });
    paths.push(`${IMAGE_PATH_PREFIX}${saved.id}`);
  }
  return { paths };
}
