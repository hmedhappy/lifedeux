"use client";

import { useRef, useState } from "react";
import { useI18n } from "./i18n-provider";

const MAX_SIDE = 1600;

/** Downscales a photo in the browser so uploads stay small (JPEG, 1600px max). */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function ImageInput({ name, multiple = false }: { name: string; multiple?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return setPreviews([]);
    setBusy(true);
    const resized = await Promise.all(files.map(shrink));
    const transfer = new DataTransfer();
    resized.forEach((f) => transfer.items.add(f));
    input.files = transfer.files;
    setPreviews(resized.map((f) => URL.createObjectURL(f)));
    setBusy(false);
  }

  return (
    <div>
      <input
        ref={ref}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        onChange={onChange}
        className="block w-full text-sm text-muted file:me-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
      />
      {busy && <p className="mt-2 text-xs text-muted">{t("common.loading")}</p>}
      {previews.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previews.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
