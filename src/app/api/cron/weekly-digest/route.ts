/**
 * Sunday 15:00 Europe/Prague — weekly rozpis for each technician (own reservations)
 * and for the super admin (all reservations).
 *
 * Vercel cron runs in UTC, so vercel.json schedules this at both 13:00 and 14:00 UTC
 * on Sundays; only the run that lands in the 15:00 Prague hour sends (CEST vs CET).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../db";
import {
  dk_reservations,
  dk_services,
  dk_locations,
  dk_accounts,
  dk_technicians,
  dk_users,
} from "../../../../../db/schema";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { sendWeeklyDigest, type DigestReservation } from "../../../../lib/email";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;
const TZ = "Europe/Prague";

function pragueParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    weekday: get("weekday"),
  };
}

/** UTC instant of 00:00 Prague time on the given calendar date. */
function pragueMidnight(year: number, month: number, day: number): Date {
  // At 00:00 UTC Prague is at 01:00 (CET) or 02:00 (CEST) of the same date, i.e. the offset.
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0));
  const offsetH = pragueParts(utcMidnight).hour;
  return new Date(utcMidnight.getTime() - offsetH * 3600_000);
}

export async function GET(req: NextRequest) {
  if (CRON_SECRET && req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const p = pragueParts(now);
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force && (p.weekday !== "Sun" || p.hour !== 15)) {
    return NextResponse.json({ ok: true, skipped: `Prague ${p.weekday} ${p.hour}:00` });
  }

  // Upcoming Monday 00:00 → following Monday 00:00 (Prague)
  const todayUtcDate = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const daysToMonday = ((8 - todayUtcDate.getUTCDay()) % 7) || 7;
  const days: { y: number; m: number; d: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(todayUtcDate.getTime() + (daysToMonday + i) * 86400_000);
    days.push({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
  }
  const after = new Date(todayUtcDate.getTime() + (daysToMonday + 7) * 86400_000);
  const weekStart = pragueMidnight(days[0].y, days[0].m, days[0].d);
  const weekEndExclusive = pragueMidnight(after.getUTCFullYear(), after.getUTCMonth() + 1, after.getUTCDate());
  const dayStarts = days.map((d) => pragueMidnight(d.y, d.m, d.d));

  const rows = await db
    .select({
      r: dk_reservations,
      serviceName: dk_services.name,
      accountName: dk_accounts.name,
      location: dk_locations,
    })
    .from(dk_reservations)
    .innerJoin(dk_services, eq(dk_services.id, dk_reservations.service_id))
    .innerJoin(dk_accounts, eq(dk_accounts.id, dk_reservations.account_id))
    .innerJoin(dk_locations, eq(dk_locations.id, dk_reservations.location_id))
    .where(
      and(
        inArray(dk_reservations.status, ["pending", "confirmed", "rescheduled"]),
        gte(dk_reservations.starts_at, weekStart),
        lt(dk_reservations.starts_at, weekEndExclusive)
      )
    )
    .orderBy(asc(dk_reservations.starts_at));

  const technicians = await db.select().from(dk_technicians).where(eq(dk_technicians.active, true));
  const techName = new Map(technicians.map((t) => [t.id, t.display_name]));

  const toDigest = (x: (typeof rows)[number]): DigestReservation & { technicianId: string | null } => ({
    technicianId: x.r.technician_id,
    startsAt: x.r.starts_at,
    endsAt: x.r.ends_at,
    status: x.r.status,
    serviceName: x.serviceName,
    accountName: x.accountName,
    locationLabel: x.location.label,
    locationAddress: `${x.location.street}, ${x.location.zip} ${x.location.city}`,
    accessNote: x.location.access_note,
    requesterName: x.r.requester_name,
    requesterPhone: x.r.requester_phone,
    patientName: x.r.patient_name,
    note: x.r.note,
    technicianName: x.r.technician_id ? techName.get(x.r.technician_id) : undefined,
  });
  const all = rows.map(toDigest);

  const byDay = (list: DigestReservation[]) =>
    dayStarts.map((start, i) => {
      const end = i < 6 ? dayStarts[i + 1] : weekEndExclusive;
      return { date: new Date(start.getTime() + 12 * 3600_000), reservations: list.filter((r) => r.startsAt >= start && r.startsAt < end) };
    });

  const lastDay = new Date(dayStarts[6].getTime() + 12 * 3600_000);
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim() || null;
  const sent: string[] = [];
  const errors: string[] = [];

  if (adminEmail) {
    try {
      await sendWeeklyDigest({ to: [adminEmail], weekStart: dayStarts[0], weekEnd: lastDay, days: byDay(all), showTechnician: true });
      sent.push("admin");
    } catch (err) {
      errors.push(`admin: ${err instanceof Error ? err.message : err}`);
    }
  }

  const linkedUserIds = technicians.filter((t) => !t.email && t.user_id).map((t) => t.user_id!);
  const linkedUsers = linkedUserIds.length
    ? await db.select({ id: dk_users.id, email: dk_users.email }).from(dk_users).where(inArray(dk_users.id, linkedUserIds))
    : [];

  for (const tech of technicians) {
    const email = (tech.email ?? linkedUsers.find((u) => u.id === tech.user_id)?.email ?? "").toLowerCase();
    if (!email || email === adminEmail) continue;
    try {
      await sendWeeklyDigest({
        to: [email],
        weekStart: dayStarts[0],
        weekEnd: lastDay,
        days: byDay(all.filter((r) => r.technicianId === tech.id)),
        showTechnician: false,
      });
      sent.push(tech.display_name);
    } catch (err) {
      errors.push(`${tech.display_name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return NextResponse.json({ ok: errors.length === 0, reservations: all.length, sent, errors });
}
