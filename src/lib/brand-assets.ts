import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** PNG versions of the Medelys logo (public/brand/), for PDFs drawn with pdf-lib. 1024×230 each. */
export type BrandPng = "logo-horizontal" | "logo-horizontal-white";

export const LOGO_RATIO = 1024 / 230;

const cache = new Map<BrandPng, Promise<Uint8Array>>();

export function brandPng(name: BrandPng): Promise<Uint8Array> {
  let bytes = cache.get(name);
  if (!bytes) {
    bytes = readFile(path.join(process.cwd(), "public", "brand", `${name}.png`)).then((b) => new Uint8Array(b));
    cache.set(name, bytes);
  }
  return bytes;
}
