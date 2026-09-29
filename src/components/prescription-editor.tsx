"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileSignature, Loader2, Pill, Plus, Search, Trash2, X } from "lucide-react";
import { issuePrescriptionAction, savePrescriptionDraftAction, type PrescriptionDraft } from "@/actions/prescription";
import type { MedicationHit } from "@/lib/medications";
import { useI18n } from "./i18n-provider";
import { Button, Input, Notice, Textarea } from "./ui";

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

export function PrescriptionEditor({ consultationId, hasStamp }: { consultationId: string; hasStamp: boolean }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedicationHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  const shown = query.trim().length < 2 ? [] : results;

  if (!hasStamp) {
    return <Notice tone="warning">{t("rx.stampMissing")}</Notice>;
  }

  const update = (key: string, patch: Partial<Item>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    setDraftId(null);
  };

  function add(item: Item) {
    setItems((list) => [...list, item]);
    setQuery("");
    setResults([]);
    setDraftId(null);
  }

  function doPreview() {
    setMessage(null);
    start(async () => {
      const res = await savePrescriptionDraftAction(consultationId, {
        items: items.map((i) => ({
          medicationId: i.medicationId,
          name: i.name,
          dosage: i.dosage,
          frequency: i.frequency,
          duration: i.duration,
          instructions: i.instructions,
        })),
        notes,
      });
      if (!res.ok) return setMessage({ tone: "error", text: t(res.error) });
      setDraftId(res.id);
      setPreview(`/api/prescriptions/${res.id}/pdf?v=${Date.now()}`);
    });
  }

  function send() {
    if (!draftId) return;
    start(async () => {
      const res = await issuePrescriptionAction(draftId);
      if (!res.ok) return setMessage({ tone: "error", text: t(res.error) });
      setPreview(null);
      setDraftId(null);
      setItems([]);
      setNotes("");
      setMessage({ tone: "success", text: t("rx.sent") });
    });
  }

  return (
    <div className="space-y-4" data-testid="rx-editor">
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

      <Textarea value={notes} onChange={(e) => { setNotes(e.target.value); setDraftId(null); }} placeholder={t("rx.notes")} aria-label={t("rx.notes")} rows={2} />

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={doPreview} disabled={pending || items.length === 0}>
          {pending && !draftId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("rx.preview")}
        </Button>
        <Button type="button" onClick={send} disabled={pending || !draftId}>
          <FileSignature className="h-4 w-4" aria-hidden />
          {t("rx.send")}
        </Button>
      </div>
      <p className="text-xs text-muted">{t("rx.previewFirst")}</p>

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4" role="dialog" aria-modal aria-label={t("rx.preview")}>
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-t-2xl bg-white px-4 py-3">
            <p className="font-semibold text-ink">{t("rx.preview")}</p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={send} disabled={pending || !draftId}>
                <FileSignature className="h-4 w-4" aria-hidden />
                {t("rx.send")}
              </Button>
              <button type="button" onClick={() => setPreview(null)} aria-label={t("common.close")} className="rounded-lg p-2 hover:bg-surface">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
          <iframe src={preview} title={t("rx.preview")} className="mx-auto w-full max-w-3xl flex-1 rounded-b-2xl bg-white" data-testid="rx-preview" />
        </div>
      )}
    </div>
  );
}
