"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

const noopSubscribe = () => () => {};

/** Uses the browser's BarcodeDetector when available; the phone camera app works everywhere else. */
export function QrScanner() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "BarcodeDetector" in window && !!navigator.mediaDevices,
    () => null,
  );
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        while (!stopped) {
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const match = codes.map((c) => c.rawValue.match(/\/scan\/([A-Za-z0-9_-]{16,})/)).find(Boolean);
          if (match) {
            stopped = true;
            router.push(`/${locale}/scan/${match[1]}`);
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
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

  if (supported === false) return <p className="text-sm text-muted">{t("scan.cameraHint")}</p>;

  return (
    <div>
      {active ? (
        <div className="space-y-3">
          <video ref={videoRef} className="aspect-square w-full max-w-sm rounded-2xl bg-black object-cover" muted playsInline />
          <Button type="button" variant="secondary" onClick={() => setActive(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      ) : (
        <Button type="button" size="lg" onClick={() => setActive(true)} disabled={!supported}>
          {t("scan.openCamera")}
        </Button>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{t("scan.cameraError")}</p>}
      <p className="mt-3 text-sm text-muted">{t("scan.cameraHint")}</p>
    </div>
  );
}
