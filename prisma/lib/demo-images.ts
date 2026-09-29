import { PNG } from "pngjs";

/** Transparent PNG with pixels set by `paint(x, y) → [r, g, b, a] | null`. */
function draw(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number] | null): Uint8Array<ArrayBuffer> {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const c = paint(x, y) ?? [0, 0, 0, 0];
      png.data[i] = c[0];
      png.data[i + 1] = c[1];
      png.data[i + 2] = c[2];
      png.data[i + 3] = c[3];
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}

/** A round blue "doctor's stamp": two rings and a cross in the middle. */
export function demoStamp(): Uint8Array<ArrayBuffer> {
  const size = 240;
  const c = size / 2;
  return draw(size, size, (x, y) => {
    const d = Math.hypot(x - c, y - c);
    const ink: [number, number, number, number] = [30, 64, 175, 215];
    if ((d > 108 && d < 116) || (d > 88 && d < 92)) return ink;
    if (d < 60 && ((Math.abs(x - c) < 10 && Math.abs(y - c) < 42) || (Math.abs(y - c) < 10 && Math.abs(x - c) < 42))) return ink;
    // Dotted band between the rings, standing in for the circular text.
    if (d > 96 && d < 104 && Math.floor((Math.atan2(y - c, x - c) + Math.PI) * 18) % 2 === 0) return ink;
    return null;
  });
}

/** A handwritten-looking stroke. */
export function demoSignature(): Uint8Array<ArrayBuffer> {
  const w = 300;
  const h = 110;
  return draw(w, h, (x, y) => {
    const t = x / w;
    const curve = h / 2 + Math.sin(t * Math.PI * 5) * 26 * (1 - t * 0.5) + Math.cos(t * Math.PI * 11) * 6;
    return x > 12 && x < w - 12 && Math.abs(y - curve) < 2.4 ? [17, 24, 39, 255] : null;
  });
}

/** Stand-in for a patient photo in the demo chat. */
export function demoPhoto(): Uint8Array<ArrayBuffer> {
  return draw(320, 220, (x, y) => {
    const d = Math.hypot(x - 160, y - 110);
    const skin = [233, 196, 170];
    const spot = d < 34 ? 0.55 : d < 44 ? 0.8 : 1;
    return [Math.round(skin[0] * spot + (1 - spot) * 190), Math.round(skin[1] * spot), Math.round(skin[2] * spot), 255];
  });
}
