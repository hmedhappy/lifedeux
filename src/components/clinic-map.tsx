"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { Button, Input } from "./ui";

type Point = { lat: number; lng: number };
type Place = { display_name: string; lat: string; lon: string; address?: Record<string, string> };

/** Tunis: where most doctors on Medelys practise. */
const START: Point = { lat: 36.8065, lng: 10.1815 };
const NOMINATIM = "https://nominatim.openstreetmap.org";

function cityOf(address?: Record<string, string>): string {
  return address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? address?.state ?? "";
}

/**
 * Clinic address with a map: search an address (OpenStreetMap), tap the map or drag the pin.
 * Writes clinicAddress, city, clinicLat and clinicLng into the surrounding form.
 */
export function ClinicMap({ defaultCity = "" }: { defaultCity?: string }) {
  const { t, locale } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [point, setPoint] = useState<Point | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const placeRef = useRef<(p: Point, fill: boolean) => void>(() => undefined);

  async function reverse(p: Point) {
    try {
      const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&lat=${p.lat}&lon=${p.lng}&accept-language=${locale}`);
      const data = (await res.json()) as Place;
      if (data.display_name) setAddress(data.display_name.split(",").slice(0, 3).join(",").trim());
      const c = cityOf(data.address);
      if (c) setCity(c);
    } catch {
      // Offline or rate-limited: the doctor types the address instead.
    }
  }

  function place(p: Point, fill: boolean) {
    setPoint(p);
    setNotFound(false);
    marker.current?.setLatLng(p);
    map.current?.setView(p, Math.max(map.current.getZoom(), 16));
    if (fill) void reverse(p);
  }

  // Leaflet's handlers are bound once; they reach the latest `place` through this ref.
  useEffect(() => {
    placeRef.current = place;
  });

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !box.current || map.current) return;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(START, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const icon = L.divIcon({ className: "clinic-pin", html: "<span></span>", iconSize: [28, 36], iconAnchor: [14, 34] });
      const mk = L.marker(START, { draggable: true, icon, opacity: 0 }).addTo(m);
      const show = (p: Point) => {
        mk.setOpacity(1);
        placeRef.current(p, true);
      };
      m.on("click", (e) => show(e.latlng));
      mk.on("dragend", () => show(mk.getLatLng()));
      map.current = m;
      marker.current = mk;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  async function search() {
    const q = address.trim();
    if (q.length < 3) return;
    setSearching(true);
    setNotFound(false);
    try {
      const res = await fetch(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&accept-language=${locale}&q=${encodeURIComponent(q)}`);
      const list = (await res.json()) as Place[];
      setResults(list);
      setNotFound(list.length === 0);
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  function pick(r: Place) {
    setResults([]);
    setAddress(r.display_name.split(",").slice(0, 3).join(",").trim());
    const c = cityOf(r.address);
    if (c) setCity(c);
    marker.current?.setOpacity(1);
    place({ lat: Number(r.lat), lng: Number(r.lon) }, false);
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        marker.current?.setOpacity(1);
        place({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true);
      },
      () => setNotFound(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="clinicAddress" className="mb-1.5 block text-sm font-medium text-ink">
          {t("onboard.address")}
        </label>
        <div className="flex gap-2">
          <Input
            id="clinicAddress"
            name="clinicAddress"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder={t("onboard.addressPlaceholder")}
            autoComplete="street-address"
            required
            data-testid="clinic-address"
          />
          <Button type="button" variant="secondary" onClick={search} disabled={searching} aria-label={t("onboard.search")} className="shrink-0 px-3">
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        {results.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-float" data-testid="clinic-results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" onClick={() => pick(r)} className="flex w-full items-start gap-2 px-3 py-2.5 text-start text-sm text-ink hover:bg-surface">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {notFound && <p className="mt-1.5 text-xs text-danger">{t("onboard.noResult")}</p>}
      </div>

      <div className="relative isolate overflow-hidden rounded-2xl border border-line">
        <div ref={box} className="h-64 w-full bg-surface sm:h-72" data-testid="clinic-map" />
        <button
          type="button"
          onClick={locate}
          className="absolute bottom-3 end-3 z-[500] flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-brand shadow-float hover:bg-brand-soft"
        >
          <LocateFixed className="h-4 w-4" aria-hidden />
          {t("onboard.myPosition")}
        </button>
      </div>
      <p className="text-xs text-muted">{point ? t("onboard.pinSet") : t("onboard.mapHint")}</p>

      <div>
        <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-ink">
          {t("onboard.city")}
        </label>
        <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" required />
      </div>
      <input type="hidden" name="clinicLat" value={point?.lat ?? ""} />
      <input type="hidden" name="clinicLng" value={point?.lng ?? ""} />
    </div>
  );
}
