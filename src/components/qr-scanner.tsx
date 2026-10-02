"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

const noopSubscribe = () => () => {};
const TOKEN = /\/scan\/([A-Za-z0-9_-]{16,})/;

/**
 * Camera QR scanner. Uses the browser's BarcodeDetector where it exists (Android
 * Chrome) and jsQR on a canvas elsewhere, so it also works in Safari on iPhone.
 */
export function QrScanner() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const supported = useSyncExternalStore(noopSubscribe, () => !!navigator.mediaDevices?.getUserMedia, () => null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let stopped = false;

    (async () => {
      try {
        const native = "BarcodeDetector" in window ? new (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector({ formats: ["qr_code"] }) : null;
        const jsQR = native ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        while (!stopped) {
          let value: string | null = null;
          if (native) {
            value = (await native.detect(video).catch(() => []))[0]?.rawValue ?? null;
          } else if (jsQR && ctx && video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            value = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
          }
          const match = value?.match(TOKEN);
          if (match) {
            stopped = true;
            navigator.vibrate?.(60);
            router.push(`/${locale}/scan/${match[1]}`);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setError(true);
        setActive(false);
      }
    })();

    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, locale, router]);

  return (
    <div>
      {active ? (
        <div className="space-y-3">
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <span className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-white/80" aria-hidden />
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setActive(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      ) : (
        <Button type="button" size="lg" className="w-full" onClick={() => setActive(true)} disabled={supported === false} data-testid="scan-camera">
          <Camera className="h-5 w-5" aria-hidden />
          {t("scan.openCamera")}
        </Button>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{t("scan.cameraError")}</p>}
      {supported === false && <p className="mt-3 text-sm text-muted">{t("scan.cameraHint")}</p>}
    </div>
  );
}
