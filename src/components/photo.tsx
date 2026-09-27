"use client";

import { useState } from "react";
import clsx from "clsx";

/** Image with a soft branded placeholder when the URL is missing or fails to load. */
export function Photo({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={clsx(
          "flex items-center justify-center overflow-hidden bg-gradient-to-br from-rose-100 via-orange-50 to-amber-100",
          className,
        )}
      >
        <svg viewBox="0 0 64 64" className="h-1/3 w-1/3 text-brand/70" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M10 30 32 12l22 18" />
          <path d="M16 26v24h32V26" />
          <path d="M27 50V37h10v13" />
        </svg>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={clsx("object-cover", className)}
    />
  );
}
