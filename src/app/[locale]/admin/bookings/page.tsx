import Link from "next/link";
import clsx from "clsx";
import type { BookingStatus, Prisma } from "@prisma/client";
import { StatusBadge } from "@/components/status";
import { EmptyState, Input, PageTitle, Table, Td, Th } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

const FILTERS: (BookingStatus | "ALL")[] = ["ALL", "REQUESTED", "CONFIRMED", "PAID", "IN_PROGRESS", "COMPLETED", "REFUSED", "EXPIRED", "CANCELLED"];

export default async function AdminBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const { status, q } = await searchParams;
  const filter = FILTERS.includes(status as BookingStatus) ? (status as BookingStatus | "ALL") : "ALL";
  const query = q?.trim();

  const where: Prisma.BookingWhereInput = {
    ...(filter !== "ALL" ? { status: filter } : {}),
    ...(query
      ? {
          OR: [
            { reference: { contains: query, mode: "insensitive" } },
            { patient: { lastName: { contains: query, mode: "insensitive" } } },
            { patient: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const bookings = await db.booking.findMany({
    where,
    include: { patient: true, doctor: { include: { user: true } }, operation: true, slot: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageTitle title={t("admin.bookingsTitle")} />
      <form className="mb-4 max-w-sm">
        {filter !== "ALL" && <input type="hidden" name="status" value={filter} />}
        <Input type="search" name="q" defaultValue={query} placeholder={t("admin.searchBookings")} aria-label={t("admin.searchBookings")} />
      </form>
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/${locale}/admin/bookings${f === "ALL" ? "" : `?status=${f}`}`}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 text-sm",
              filter === f ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
            )}
          >
            {f === "ALL" ? t("admin.all") : t(`status.${f}`)}
          </Link>
        ))}
      </div>
      {bookings.length === 0 ? (
        <EmptyState title={t("admin.noBookings")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("admin.col.reference")}</Th>
              <Th>{t("admin.col.patient")}</Th>
              <Th>{t("admin.col.doctor")}</Th>
              <Th>{t("admin.col.date")}</Th>
              <Th>{t("admin.col.total")}</Th>
              <Th>{t("admin.col.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <Td>
                  <Link href={`/${locale}/admin/bookings/${b.id}`} className="font-mono font-semibold underline">
                    {b.reference}
                  </Link>
                </Td>
                <Td>
                  {b.patient.firstName} {b.patient.lastName}
                  <p className="text-xs text-muted">{b.patient.country}</p>
                </Td>
                <Td>
                  Dr {b.doctor.user.lastName}
                  <p className="text-xs text-muted">{localized(b.operation, "name", locale)}</p>
                </Td>
                <Td>{formatDateTime(b.slot.startsAt, locale)}</Td>
                <Td>{formatMoney(b.totalAmount, b.currency, locale)}</Td>
                <Td>
                  <StatusBadge status={b.status} t={t} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
