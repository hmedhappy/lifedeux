import { describe, expect, it } from "vitest";
import { cityCentre } from "@/lib/cities";

describe("cityCentre", () => {
  it("finds a city whatever the case, accents or governorate prefix", () => {
    expect(cityCentre("Tunis")).toEqual({ lat: 36.8065, lng: 10.1815 });
    expect(cityCentre("Gouvernorat Ariana")).toEqual(cityCentre("ariana"));
    expect(cityCentre("Gabès")).toEqual(cityCentre("gabes"));
  });

  it("returns null for an unknown place", () => {
    expect(cityCentre("Paris")).toBeNull();
  });
});
