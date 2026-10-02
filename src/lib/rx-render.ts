/** Draws the operations of `buildSheet` as a PDF page (pdf-lib) or as an SVG preview. */
import { LineCapStyle, PDFDocument, StandardFonts, degrees, rgb, setCharacterSpacing, type PDFImage } from "pdf-lib";
import { PAGE_H, PAGE_W, type ImageRef, type Op } from "./rx-sheet";

type ImageBytes = { bytes: Uint8Array; mime: string };

function color(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Box of an image fitted into (x, y, w, h), in top-left coordinates. */
function place(op: Extract<Op, { t: "image" }>, iw: number, ih: number) {
  if (op.fit === "fill") return { x: op.x, y: op.y, w: op.w, h: op.h };
  const s = Math.min(op.w / iw, op.h / ih);
  const w = iw * s;
  const h = ih * s;
  return { x: op.align === "left" ? op.x : op.x + (op.w - w) / 2, y: op.y + (op.h - h) / 2, w, h };
}

export async function opsToPdf(ops: Op[], images: Partial<Record<ImageRef, ImageBytes | null>>, meta: { title: string; author: string }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.title);
  pdf.setAuthor(meta.author);
  pdf.setProducer("Medelys");
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const fonts = {
    r: await pdf.embedFont(StandardFonts.Helvetica),
    b: await pdf.embedFont(StandardFonts.HelveticaBold),
    i: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  const embedded = new Map<ImageRef, PDFImage | null>();
  for (const [ref, img] of Object.entries(images) as [ImageRef, ImageBytes | null][]) {
    if (!img) continue;
    // Only PNG and JPEG can be embedded; anything else is skipped rather than failing the document.
    const e = img.mime === "image/png" ? await pdf.embedPng(img.bytes) : img.mime === "image/jpeg" ? await pdf.embedJpg(img.bytes) : null;
    embedded.set(ref, e);
  }

  for (const op of ops) {
    switch (op.t) {
      case "rect":
        page.drawRectangle({ x: op.x, y: PAGE_H - op.y - op.h, width: op.w, height: op.h, color: color(op.fill), opacity: op.opacity });
        break;
      case "box":
        page.drawRectangle({ x: op.x, y: PAGE_H - op.y - op.h, width: op.w, height: op.h, borderColor: color(op.color), borderWidth: 0.8, borderDashArray: [4, 3] });
        break;
      case "line":
        page.drawLine({ start: { x: op.x1, y: PAGE_H - op.y1 }, end: { x: op.x2, y: PAGE_H - op.y2 }, thickness: op.width, color: color(op.color) });
        break;
      case "circle":
        page.drawCircle({ x: op.cx, y: PAGE_H - op.cy, size: op.r, color: color(op.fill) });
        break;
      case "path":
        page.drawSvgPath(op.d, {
          x: op.x,
          y: PAGE_H - op.y,
          scale: op.scale,
          borderColor: color(op.color),
          borderWidth: op.width,
          borderOpacity: op.opacity,
          borderLineCap: LineCapStyle.Round,
        });
        break;
      case "text":
        if (op.spacing) page.pushOperators(setCharacterSpacing(op.spacing));
        page.drawText(op.s, {
          x: op.x,
          y: PAGE_H - op.y,
          size: op.size,
          font: fonts[op.font],
          color: color(op.color),
          opacity: op.opacity,
          rotate: op.rotate ? degrees(op.rotate) : undefined,
        });
        if (op.spacing) page.pushOperators(setCharacterSpacing(0));
        break;
      case "image": {
        const img = embedded.get(op.ref);
        if (!img) break;
        const b = place(op, img.width, img.height);
        page.drawImage(img, { x: b.x, y: PAGE_H - b.y - b.h, width: b.w, height: b.h });
        break;
      }
    }
  }
  return pdf.save();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const n = (v: number) => (Math.round(v * 100) / 100).toString();

/**
 * Same page as SVG. Images are referenced by URL (`hrefs`); image sizes are
 * needed to reproduce the PDF placement exactly and default to a square.
 */
export function opsToSvg(ops: Op[], hrefs: Partial<Record<ImageRef, { href: string; width: number; height: number } | null>>): string {
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="Helvetica, Arial, sans-serif" role="img">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>`,
  ];
  for (const op of ops) {
    switch (op.t) {
      case "rect":
        out.push(`<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="${op.fill}" shape-rendering="crispEdges"${op.opacity != null ? ` opacity="${op.opacity}"` : ""}/>`);
        break;
      case "box":
        out.push(`<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="none" stroke="${op.color}" stroke-width="0.8" stroke-dasharray="4 3"/>`);
        break;
      case "line":
        out.push(`<line x1="${n(op.x1)}" y1="${n(op.y1)}" x2="${n(op.x2)}" y2="${n(op.y2)}" stroke="${op.color}" stroke-width="${op.width}"/>`);
        break;
      case "circle":
        out.push(`<circle cx="${n(op.cx)}" cy="${n(op.cy)}" r="${n(op.r)}" fill="${op.fill}"/>`);
        break;
      case "path":
        out.push(
          `<path d="${esc(op.d)}" transform="translate(${n(op.x)} ${n(op.y)}) scale(${op.scale})" fill="none" stroke="${op.color}" stroke-width="${op.width}" stroke-linecap="round"${op.opacity != null ? ` opacity="${op.opacity}"` : ""}/>`,
        );
        break;
      case "text": {
        const attrs = [
          `x="${n(op.x)}"`,
          `y="${n(op.y)}"`,
          `font-size="${op.size}"`,
          `fill="${op.color}"`,
          op.font === "b" ? `font-weight="bold"` : "",
          op.font === "i" ? `font-style="italic"` : "",
          op.spacing ? `letter-spacing="${op.spacing}"` : "",
          op.opacity != null ? `opacity="${op.opacity}"` : "",
          op.rotate ? `transform="rotate(${-op.rotate} ${n(op.x)} ${n(op.y)})"` : "",
        ].filter(Boolean);
        out.push(`<text ${attrs.join(" ")} xml:space="preserve">${esc(op.s)}</text>`);
        break;
      }
      case "image": {
        const img = hrefs[op.ref];
        if (!img) break;
        const b = place(op, img.width, img.height);
        out.push(`<image href="${esc(img.href)}" x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" preserveAspectRatio="none"/>`);
        break;
      }
    }
  }
  out.push("</svg>");
  return out.join("");
}
