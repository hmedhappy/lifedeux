import { Scissors, Video } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Field, Input, Notice, PageTitle } from "@/components/ui";
import { addSlotsAction, deleteSlotAction } from "@/actions/doctor";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatTime, tunisDayKey } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";

export default async function DoctorSlotsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { welcome } = await searchParams;
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);
  // Surgeons publish procedure slots by default; everyone else consultation slots.
  const defaultKind = (await db.doctorOperation.count({ where: { doctorId: doctor.id } })) > 0 ? "OPERATION" : "CONSULTATION";
  const slots = await db.slot.findMany({
    where: { doctorId: doctor.id, startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
    take: 300,
    include: { _count: { select: { bookings: true, consultations: true } } },
  });

  const days = new Map<string, typeof slots>();
  for (const s of slots) {
    const key = tunisDayKey(s.startsAt);
    days.set(key, [...(days.get(key) ?? []), s]);
  }
  const today = tunisDayKey(new Date());
  // Monday-first display; values follow JS getDay() (0 = Sunday).
  const weekdays = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="space-y-10">
      {welcome && <Notice tone="success">{t("referral.welcome")}</Notice>}
      <PageTitle title={t("doctorArea.slotsTitle")} subtitle={t("doctorArea.slotsSubtitle")} />
      <Card>
        <h2 className="text-lg font-semibold text-ink">{t("doctorArea.addSlots")}</h2>
        <ActionForm action={addSlotsAction.bind(null, locale)} className="mt-5 space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t("doctorArea.slotKind")}</legend>
            <div className="flex flex-wrap gap-2">
              {(["CONSULTATION", "OPERATION"] as const).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-line px-4 py-2.5 text-sm has-[:checked]:border-ink">
                  <input type="radio" name="kind" value={k} defaultChecked={k === defaultKind} className="accent-brand" />
                  {k === "CONSULTATION" ? <Video className="h-4 w-4" aria-hidden /> : <Scissors className="h-4 w-4" aria-hidden />}
                  {t(`slotKind.${k}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("doctorArea.from")}>
              <Input type="date" name="from" min={today} required />
            </Field>
            <Field label={t("doctorArea.to")} hint={t("doctorArea.toHint")}>
              <Input type="date" name="to" min={today} />
            </Field>
            <Field label={t("doctorArea.times")} hint={t("doctorArea.timesHint")}>
              <Input name="times" placeholder="09:00, 11:00, 14:30" required />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t("doctorArea.weekdays")}</legend>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                  <input type="checkbox" name="weekdays" value={d} defaultChecked={d >= 1 && d <= 5} className="sr-only" />
                  {t(`weekdays.${d}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton>{t("doctorArea.createSlots")}</SubmitButton>
        </ActionForm>
      </Card>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">{t("doctorArea.upcomingSlots")}</h2>
        {days.size === 0 ? (
          <EmptyState title={t("doctorArea.noSlots")} />
        ) : (
          <div className="space-y-4">
            {[...days.entries()].map(([key, daySlots]) => (
              <div key={key} className="rounded-2xl border border-line p-5">
                <p className="font-semibold capitalize text-ink">
                  {formatDate(daySlots[0].startsAt, locale, { weekday: "long" })}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {daySlots.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-lg border border-line py-1.5 ps-3 pe-1.5 text-sm">
                      {s.kind === "CONSULTATION" ? (
                        <Video className="h-3.5 w-3.5 text-brand" aria-label={t("slotKind.CONSULTATION")} />
                      ) : (
                        <Scissors className="h-3.5 w-3.5 text-muted" aria-label={t("slotKind.OPERATION")} />
                      )}
                      <span className="font-medium">{formatTime(s.startsAt, locale)}</span>
                      {s.status === "FREE" ? (
                        s._count.bookings + s._count.consultations === 0 ? (
                          <form action={deleteSlotAction.bind(null, locale, s.id)}>
                            <button
                              type="submit"
                              aria-label={t("doctorArea.deleteSlot")}
                              className="rounded-md px-1.5 text-muted hover:bg-surface hover:text-red-700"
                            >
                              ×
                            </button>
                          </form>
                        ) : (
                          <Badge>{t("slotStatus.FREE")}</Badge>
                        )
                      ) : (
                        <Badge tone={s.status === "BOOKED" ? "green" : "amber"}>{t(`slotStatus.${s.status}`)}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
