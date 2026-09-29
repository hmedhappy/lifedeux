"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Expand, FileSignature, FileText, Loader2, Pill, Plus, Search, Trash2, X } from "lucide-react";
import { issuePrescriptionAction, savePrescriptionDraftAction, type PrescriptionDraft } from "@/actions/prescription";
import type { MedicationHit } from "@/lib/medications";
import { useI18n } from "./i18n-provider";
import { Button, Input, Notice, Select, Textarea } from "./ui";

type Item = PrescriptionDraft["items"][number] & { key: string };

const blank = (name = "", medicationId: string | null = null): Item => ({
  key: Math.random().toString(36).slice(2),
  medicationId,
  name,
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
});

const label = (m: MedicationHit) => [m.name, m.strength, m.form].filter((v) => v && v !== "—").join(" · ");
const PREVIEW_DELAY_MS = 400;

/** The rendered page (SVG made by the server from the same layout as the PDF). */
function Sheet({ svg, className = "" }: { svg: string; className?: string }) {
  return <div className={`[&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function PrescriptionEditor({
  consultationId,
  hasStamp,
  templates,
  defaultTemplate,
}: {
  consultationId: string;
  hasStamp: boolean;
  templates: { ref: string; name: string }[];
  defaultTemplate: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedicationHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState("");
  const [templateRef, setTemplateRef] = useState(defaultTemplate);
  const [svg, setSvg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 2) return;
    timer.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/medications?q=${encodeURIComponent(query)}`).catch(() => null);
      setSearching(false);
      if (res?.ok) setResults(((await res.json()) as { results: MedicationHit[] }).results);
    }, 250);
    return () => clearTimeout(timer.current);
  }, [query]);

  const payload = () => ({
    items: items.map((i) => ({
      medicationId: i.medicationId,
      name: i.name,
      dosage: i.dosage,
      frequency: i.frequency,
      duration: i.duration,
      instructions: i.instructions,
    })),
    notes,
    templateRef,
  });

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

  const shown = query.trim().length < 2 ? [] : results;
  const liveSvg = items.length > 0 ? svg : null;

  if (!hasStamp) {
    return <Notice tone="warning">{t("rx.stampMissing")}</Notice>;
  }

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  function add(item: Item) {
    setItems((list) => [...list, item]);
    setQuery("");
    setResults([]);
  }

  async function saveDraft(): Promise<string | null> {
    const res = await savePrescriptionDraftAction(consultationId, payload());
    if (!res.ok) {
      setMessage({ tone: "error", text: t(res.error) });
      return null;
    }
    return res.id;
  }

  function openPdf() {
    setMessage(null);
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
    setMessage(null);
    if (!window.confirm(t("rx.sendConfirm"))) return;
    start(async () => {
      const id = await saveDraft();
      if (!id) return;
      const res = await issuePrescriptionAction(id);
      if (!res.ok) {
        setMessage({ tone: "error", text: t(res.error) });
        return;
      }
      setExpanded(false);
      setItems([]);
      setNotes("");
      setSvg(null);
      setMessage({ tone: "success", text: t("rx.sent") });
    });
  }

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="secondary" onClick={openPdf} disabled={pending || items.length === 0}>
        <FileText className="h-4 w-4" aria-hidden />
        {t("rx.openPdf")}
      </Button>
      <Button type="button" onClick={send} disabled={pending || items.length === 0}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSignature className="h-4 w-4" aria-hidden />}
        {t("rx.send")}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="rx-editor">
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
        {shown.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-float" role="listbox">
            {shown.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => add(blank(label(m), m.id))}
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
        )}
      </div>
      <button type="button" onClick={() => add(blank(query))} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink underline">
        <Plus className="h-4 w-4" aria-hidden />
        {t("rx.addFree")}
      </button>

      {items.length === 0 ? (
        <p className="rounded-xl bg-surface p-4 text-sm text-muted">{t("rx.empty")}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((i, index) => (
            <li key={i.key} className="rounded-xl border border-line p-3" data-testid="rx-item">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-brand">{index + 1}.</span>
                <Input value={i.name} onChange={(e) => update(i.key, { name: e.target.value })} aria-label={t("rx.medication")} className="font-medium" />
                <button
                  type="button"
                  onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                  aria-label={t("rx.remove")}
                  className="rounded-lg p-2 text-muted hover:bg-surface hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Input value={i.dosage} onChange={(e) => update(i.key, { dosage: e.target.value })} placeholder={t("rx.dosage")} aria-label={t("rx.dosage")} name="dosage" />
                <Input value={i.frequency} onChange={(e) => update(i.key, { frequency: e.target.value })} placeholder={t("rx.frequency")} aria-label={t("rx.frequency")} name="frequency" />
                <Input value={i.duration} onChange={(e) => update(i.key, { duration: e.target.value })} placeholder={t("rx.duration")} aria-label={t("rx.duration")} name="duration" />
              </div>
              <Input
                value={i.instructions ?? ""}
                onChange={(e) => update(i.key, { instructions: e.target.value })}
                placeholder={t("rx.instructions")}
                aria-label={t("rx.instructions")}
                className="mt-2"
              />
            </li>
          ))}
        </ol>
      )}

      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("rx.notes")} aria-label={t("rx.notes")} rows={2} />

      {items.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">{t("rx.livePreview")}</p>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1 text-sm font-medium text-ink underline disabled:opacity-40"
              disabled={!liveSvg}
            >
              <Expand className="h-4 w-4" aria-hidden />
              {t("rx.preview")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => liveSvg && setExpanded(true)}
            className="block w-full overflow-hidden rounded-lg border border-line bg-surface text-start shadow-sm"
            aria-label={t("rx.preview")}
            data-testid="rx-live-preview"
          >
            {liveSvg ? (
              <Sheet svg={liveSvg} />
            ) : (
              <span className="flex aspect-[595/842] items-center justify-center text-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              </span>
            )}
          </button>
        </div>
      )}

      {message && !expanded && <Notice tone={message.tone}>{message.text}</Notice>}
      {actions}
      <p className="text-xs text-muted">{t("rx.previewFirst")}</p>

      {expanded && liveSvg && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 sm:p-4" role="dialog" aria-modal aria-label={t("rx.preview")}>
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-t-2xl bg-white px-4 py-3">
            <p className="font-semibold text-ink">{t("rx.preview")}</p>
            <button type="button" onClick={() => setExpanded(false)} aria-label={t("common.close")} className="rounded-lg p-2 hover:bg-surface">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto bg-surface p-3 sm:p-6">
            <Sheet svg={liveSvg} className="mx-auto max-w-2xl bg-white shadow-float" />
          </div>
          <div className="mx-auto w-full max-w-3xl rounded-b-2xl bg-white p-4" data-testid="rx-preview">
            {message && (
              <div className="mb-3">
                <Notice tone={message.tone}>{message.text}</Notice>
              </div>
            )}
            {actions}
          </div>
        </div>
      )}
    </div>
  );
}
