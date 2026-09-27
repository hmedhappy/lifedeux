import { timingSafeEqual } from "node:crypto";
import { expireOverdueBookings } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Called by a scheduler (e.g. Vercel Cron) to release unpaid slots. */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const expired = await expireOverdueBookings();
  return Response.json({ expired });
}
