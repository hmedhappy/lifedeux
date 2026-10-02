"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { BookmarkPlus, Expand, FileSignature, FileText, Loader2, Pill, Plus, Search, Star, Trash2 } from "lucide-react";
import { issuePrescriptionAction, saveFavoriteAction, savePrescriptionDraftAction, type PrescriptionDraft } from "@/actions/prescription";
import type { MedicationHit } from "@/lib/medications";
import { POSOLOGY, type PosologyField } from "@/lib/posology";
import { useI18n } from "./i18n-provider";
import { ConfirmSheet, Sheet as Modal } from "./overlay";
import { useToast } from "./toast";
import { Button, Disclosure, Input, Notice, Select, Textarea } from "./ui";

type Line = PrescriptionDraft["items"][number];
type Item = Line & { key: string };
export type Favorite = { id: string; name: string; items: Line[]; notes: string | null };

const newKey = () => Math.random().toString(36).slice(2);
const blank = (name = "", medicationId: string | null = null): Item => ({
  key: newKey(),
  medicationId,
  name,
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
});

const label = (m: MedicationHit) => [m.name, m.strength, m.form].filter((v) => v && v !== "—").join(" · ");
const PREVIEW_DELAY_MS = 400;
const FIELDS: PosologyField[] = ["dosage", "frequency", "duration"];

/** Medicines matching what is typed (2 letters or more), shared by the search box and each line's name. */
function useMedicationSearch(query: string) {
  const [results, setResults] = useState<MedicationHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/medications?q=${encodeURIComponent(query)}`).catch(() => null);
      setSearching(false);
      if (res?.ok) setResults(((await res.json()) as { results: MedicationHit[] }).results);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  return { results: query.trim().length < 2 ? [] : results, searching };
}

function MedicationList({ hits, onPick }: { hits: MedicationHit[]; onPick: (m: MedicationHit) => void }) {
  return (
    <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-line bg-white py-1 shadow-float" role="listbox">
      {hits.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            // Keeps the focus in the field, so the list is still there when the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(m)}
            className="flex w-full items-start gap-3 px-3 py-2 text-start text-sm hover:bg-surface"
            data-testid="rx-result"
          >
            <Pill className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span>
              <span className="block font-medium text-ink">{label(m)}</span>
              {m.dci && <span className="block text-xs text-muted">{m.dci}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The medicine name of a line: free text, with the same search as the box above once the doctor types. */
function MedicationInput({ value, onType, onPick, ariaLabel }: { value: string; onType: (v: string) => void; onPick: (m: MedicationHit) => void; ariaLabel: string }) {
  const [typed, setTyped] = useState("");
  const [focused, setFocused] = useState(false);
  const { results, searching } = useMedicationSearch(typed);
  return (
    <div className="relative min-w-0 flex-1">
      <Input
        value={value}
        onChange={(e) => {
          onType(e.target.value);
          setTyped(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={ariaLabel}
        className="font-medium"
        data-testid="rx-item-name"
      />
      {searching && focused && <Loader2 className="absolute end-3 top-3.5 h-4 w-4 animate-spin text-muted" aria-hidden />}
      {focused && typed === value && results.length > 0 && (
        <MedicationList
          hits={results}
          onPick={(m) => {
            onPick(m);
            setTyped("");
          }}
        />
      )}
    </div>
  );
}

/** The rendered page (SVG made by the server from the same layout as the PDF). */
function Page({ svg, className = "" }: { svg: string; className?: string }) {
  return <div className={`[&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function PrescriptionEditor({
  consultationId,
  hasStamp,
  templates,
  defaultTemplate,
  favorites: initialFavorites = [],
  initial,
}: {
  consultationId: string;
  hasStamp: boolean;
  templates: { ref: string; name: string }[];
  defaultTemplate: string;
  favorites?: Favorite[];
  /** A draft already saved (for instance after "Annuler et remplacer"). */
  initial?: { items: Line[]; notes: string | null } | null;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const { results: shown, searching } = useMedicationSearch(query);
  const [items, setItems] = useState<Item[]>(() => (initial?.items ?? []).map((i) => ({ ...i, key: newKey() })));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [templateRef, setTemplateRef] = useState(defaultTemplate);
  const [svg, setSvg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  // The posology field being typed in: only its suggestions are shown.
  const [focus, setFocus] = useState<{ key: string; field: PosologyField } | null>(null);
  const fieldRefs = useRef(new Map<string, HTMLInputElement>());
  const [favorites, setFavorites] = useState(initialFavorites);
  const [favName, setFavName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const lines = (): Line[] =>
    items.map(({ medicationId, name, dosage, frequency, duration, instructions }) => ({ medicationId, name, dosage, frequency, duration, instructions }));
  const payload = () => ({ items: lines(), notes, templateRef });

  // Live preview: re-rendered shortly after every change, as soon as there is a medicine.
  const snapshot = JSON.stringify(payload());
  useEffect(() => {
    clearTimeout(previewTimer.current);
    if (items.length === 0) return;
    previewTimer.current = setTimeout(async () => {
      const res = await fetch("/api/prescriptions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId, ...JSON.parse(snapshot) }),
      }).catch(() => null);
      if (res?.ok) setSvg(await res.text());
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(previewTimer.current);
  }, [snapshot, consultationId, items.length]);

  const liveSvg = items.length > 0 ? svg : null;

  if (!hasStamp) {
    return <Notice tone="warning">{t("rx.stampMissing")}</Notice>;
  }

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  function add(item: Item) {
    setItems((list) => [...list, item]);
    setActive(item.key);
    setQuery("");
  }

  /** A suggestion fills the field, then the next one takes the focus (dosage → frequency → duration). */
  function pickPosology(key: string, field: PosologyField, value: string) {
    update(key, { [field]: value });
    const next = FIELDS[FIELDS.indexOf(field) + 1];
    if (next) fieldRefs.current.get(`${key}:${next}`)?.focus();
    else setFocus(null);
  }

  function applyFavorite(f: Favorite) {
    setItems((list) => [...list, ...f.items.map((i) => ({ ...blank(), ...i, key: newKey() }))]);
    if (f.notes && !notes) setNotes(f.notes);
    toast(t("rx.favoriteAdded", { name: f.name }));
  }

  async function saveDraft(): Promise<string | null> {
    const res = await savePrescriptionDraftAction(consultationId, payload());
    if (!res.ok) {
      setError(t(res.error));
      return null;
    }
    return res.id;
  }

  function openPdf() {
    setError(null);
    // Opened right away (inside the click) so the browser does not block it as a pop-up.
    const tab = window.open("about:blank", "_blank");
    start(async () => {
      const id = await saveDraft();
      if (!id) {
        tab?.close();
        return;
      }
      const url = `/api/prescriptions/${id}/pdf?v=${Date.now()}`;
      if (tab) tab.location.href = url;
      else window.open(url, "_self");
    });
  }

  function send() {
    setConfirming(false);
    setError(null);
    start(async () => {
      const id = await saveDraft();
      if (!id) return;
      const res = await issuePrescriptionAction(id);
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      setExpanded(false);
      setItems([]);
      setNotes("");
      setSvg(null);
      toast(t("rx.sent"), { tone: "success" });
    });
  }

  function saveFavorite() {
    const name = favName?.trim();
    if (!name) return;
    start(async () => {
      const res = await saveFavoriteAction({ name, items: lines(), notes });
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      setFavorites((list) => [{ id: res.id, name, items: lines(), notes }, ...list]);
      setFavName(null);
      toast(t("rx.favoriteSaved", { name }), { tone: "success" });
    });
  }

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="secondary" onClick={openPdf} disabled={pending || items.length === 0}>
        <FileText className="h-4 w-4" aria-hidden />
        {t("rx.openPdf")}
      </Button>
      <Button type="button" onClick={() => setConfirming(true)} disabled={pending || items.length === 0} data-testid="rx-send">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSignature className="h-4 w-4" aria-hidden />}
        {t("rx.send")}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="rx-editor">
      {favorites.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{t("rx.favoritesTitle")}</p>
          <div className="flex flex-wrap gap-2" data-testid="rx-favorites">
            {favorites.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyFavorite(f)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-medium text-ink transition hover:border-brand"
              >
                <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("rx.search")}
          aria-label={t("rx.search")}
          className="ps-9"
          data-testid="rx-search"
        />
        {searching && <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
        {shown.length > 0 && <MedicationList hits={shown} onPick={(m) => add(blank(label(m), m.id))} />}
      </div>
      <button type="button" onClick={() => add(blank(query))} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <Plus className="h-4 w-4" aria-hidden />
        {t("rx.addFree")}
      </button>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{t("rx.empty")}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((i, index) => {
            const open = active === i.key;
            return (
              <li
                key={i.key}
                onFocusCapture={() => setActive(i.key)}
                className={clsx("rounded-2xl border p-3 transition", open ? "border-brand/40 bg-brand-soft/30" : "border-line")}
                data-testid="rx-item"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-brand">{index + 1}.</span>
                  <MedicationInput
                    value={i.name}
                    onType={(name) => update(i.key, { name })}
                    onPick={(m) => update(i.key, { name: label(m), medicationId: m.id })}
                    ariaLabel={t("rx.medication")}
                  />
                  <button
                    type="button"
                    onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                    aria-label={t("rx.remove")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {FIELDS.map((f) => (
                    <Input
                      key={f}
                      ref={(el) => {
                        if (el) fieldRefs.current.set(`${i.key}:${f}`, el);
                        else fieldRefs.current.delete(`${i.key}:${f}`);
                      }}
                      value={i[f]}
                      onChange={(e) => update(i.key, { [f]: e.target.value })}
                      onFocus={() => setFocus({ key: i.key, field: f })}
                      onBlur={() => setFocus((cur) => (cur?.key === i.key && cur.field === f ? null : cur))}
                      placeholder={t(`rx.${f}`)}
                      aria-label={t(`rx.${f}`)}
                      name={f}
                      className="px-2.5"
                    />
                  ))}
                </div>
                {/* Suggestions of the focused field only, sliding in from the start side one after the other. */}
                <div
                  className={clsx(
                    "grid transition-[grid-template-rows] duration-200 ease-[var(--ease-standard)]",
                    focus?.key === i.key ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                  data-testid="rx-chips"
                >
                  <div className="overflow-hidden">
                    <div className="grid pt-2 [grid-template-areas:'chips']">
                      {FIELDS.map((f) => {
                        const visible = focus?.key === i.key && focus.field === f;
                        return (
                          <div key={f} className={clsx("-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [grid-area:chips]", !visible && "pointer-events-none")} aria-hidden={!visible}>
                            {POSOLOGY[f].map((v, n) => (
                              <button
                                key={v}
                                type="button"
                                tabIndex={visible ? 0 : -1}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickPosology(i.key, f, v)}
                                aria-pressed={i[f] === v}
                                style={{ transitionDelay: visible ? `${n * 35}ms` : "0ms" }}
                                className={clsx(
                                  "min-h-8 shrink-0 rounded-full border px-2.5 text-xs transition-[opacity,transform,background-color,border-color] duration-200",
                                  visible ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0 rtl:translate-x-3",
                                  i[f] === v ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft hover:border-brand",
                                )}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {open && (
                  <div className="mt-2 animate-fade-in">
                    <Input
                      value={i.instructions ?? ""}
                      onChange={(e) => update(i.key, { instructions: e.target.value })}
                      placeholder={t("rx.instructions")}
                      aria-label={t("rx.instructions")}
                      className="mt-1"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <Disclosure summary={t("rx.moreOptions")} defaultOpen={!!notes}>
        <div className="space-y-3">
          {templates.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">{t("rx.template")}</span>
              <Select value={templateRef} onChange={(e) => setTemplateRef(e.target.value)} data-testid="rx-template">
                {templates.map((tpl) => (
                  <option key={tpl.ref} value={tpl.ref}>
                    {tpl.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("rx.notes")} aria-label={t("rx.notes")} rows={2} />
          {items.length > 0 &&
            (favName === null ? (
              <button type="button" onClick={() => setFavName("")} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink" data-testid="rx-fav-open">
                <BookmarkPlus className="h-4 w-4" aria-hidden />
                {t("rx.saveFavorite")}
              </button>
            ) : (
              <div className="flex gap-2">
                <Input value={favName} onChange={(e) => setFavName(e.target.value)} placeholder={t("rx.favoriteName")} aria-label={t("rx.favoriteName")} maxLength={80} autoFocus data-testid="rx-fav-name" />
                <Button type="button" variant="soft" onClick={saveFavorite} disabled={pending || !favName.trim()} data-testid="rx-fav-save">
                  {t("rx.save")}
                </Button>
              </div>
            ))}
        </div>
      </Disclosure>

      {items.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
          <button
            type="button"
            onClick={() => liveSvg && setExpanded(true)}
            className="w-20 shrink-0 overflow-hidden rounded-md border border-line bg-white shadow-sm"
            aria-label={t("rx.preview")}
            data-testid="rx-live-preview"
          >
            {liveSvg ? (
              <Page svg={liveSvg} />
            ) : (
              <span className="flex aspect-[595/842] items-center justify-center text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </span>
            )}
          </button>
          <div className="min-w-0 text-sm">
            <p className="font-medium text-ink">{t("rx.livePreview")}</p>
            <p className="text-xs text-muted">{t("rx.previewFirst")}</p>
            <button type="button" onClick={() => setExpanded(true)} disabled={!liveSvg} className="mt-1 inline-flex min-h-8 items-center gap-1 font-semibold text-brand-dark disabled:opacity-40">
              <Expand className="h-4 w-4" aria-hidden />
              {t("rx.preview")}
            </button>
          </div>
        </div>
      )}

      {error && !expanded && <Notice tone="error">{error}</Notice>}
      {actions}

      <Modal open={expanded && !!liveSvg} onClose={() => setExpanded(false)} title={t("rx.preview")} size="lg" footer={actions} testId="rx-preview">
        {error && (
          <div className="mb-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {liveSvg && <Page svg={liveSvg} className="mx-auto max-w-2xl bg-white shadow-float" />}
      </Modal>
      <ConfirmSheet open={confirming} message={t("rx.sendConfirm")} confirmLabel={t("rx.send")} tone="primary" onConfirm={send} onCancel={() => setConfirming(false)} />
    </div>
  );
}
