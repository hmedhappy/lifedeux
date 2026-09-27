"use client";

import { Button } from "./ui";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="dark" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
