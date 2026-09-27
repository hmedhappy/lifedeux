"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes server data a few times, e.g. while waiting for a payment webhook. */
export function AutoRefresh({ every = 3000, times = 10 }: { every?: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= times) clearInterval(id);
    }, every);
    return () => clearInterval(id);
  }, [router, every, times]);
  return null;
}
