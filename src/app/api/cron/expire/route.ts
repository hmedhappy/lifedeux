import { timingSafeEqual } from "node:crypto";
import { runScheduledJobs } from "@/lib/jobs";

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

/**
 * Called every 5 minutes by the cron container: releases unpaid slots, sends reminders
 * and doctor nudges, forwards urgent alerts, the agents' planning, and rolls schedules.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runScheduledJobs());
}
