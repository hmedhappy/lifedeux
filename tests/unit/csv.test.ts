import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("csv import", () => {
  it("detects the delimiter and normalises headers", () => {
    const { headers, rows } = parseCsv("﻿Name;DCI;Strength\r\nDoliprane;paracétamol;1 g\r\n\r\n");
    expect(headers).toEqual(["name", "dci", "strength"]);
    expect(rows).toEqual([{ name: "Doliprane", dci: "paracétamol", strength: "1 g" }]);
  });

  it("handles quotes, escaped quotes and commas", () => {
    const { rows } = parseCsv('name,form\n"Crème ""bio"", 50 ml",tube\nX,\n');
    expect(rows).toEqual([
      { name: 'Crème "bio", 50 ml', form: "tube" },
      { name: "X", form: "" },
    ]);
  });
});
