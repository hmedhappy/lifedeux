import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthRange } from "@/lib/earnings";
import { tunisDayKey } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Monthly CSV of payouts (semicolon separated, opens directly in Excel set to French). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new Response("Not found", { status: 404 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Bad month", { status: 400 });
  const { from, to } = monthRange(month);
  const rows = await db.doctorPayout.findMany({
    where: { paidAt: { gte: from, lt: to } },
    include: { doctor: { include: { user: true } }, recordedBy: true },
    orderBy: { paidAt: "asc" },
  });
  const lines = [
    ["date", "doctor", "license", "amount", "method", "note", "recorded_by"].join(";"),
    ...rows.map((p) =>
      [tunisDayKey(p.paidAt), `${p.doctor.user.firstName} ${p.doctor.user.lastName}`, p.doctor.licenseNumber ?? "", (p.amount / 100).toFixed(2), p.method, p.note ?? "", p.recordedBy.email]
        .map(cell)
        .join(";"),
    ),
  ];
  return new Response(`﻿${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="versements-${month}.csv"` },
  });
}
