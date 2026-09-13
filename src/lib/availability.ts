/**
 * Availability engine — implements the slot algorithm from spec §6.
 *
 * For each day in the requested window, for a service with (dur, bb, ba):
 *   1. Look up working hours for the technician on that weekday (with exceptions)
 *   2. Build the busy set from existing reservations + Google freebusy
 *   3. Walk the slot grid (slot_step_min) and emit starts that don't collide
 */

import { db } from "../../db";
import {
  dk_working_hours,
  dk_exceptions,
  dk_reservations,
  dk_booking_rules,
  dk_slot_holds,
} from "../../db/schema";
import { and, eq, gte, lte, notInArray } from "drizzle-orm";
import { queryGoogleFreebusy } from "./google-calendar";

export type SlotResult = {
  date: string;        // YYYY-MM-DD
  slots: string[];     // ISO datetime strings (UTC)
  closed: boolean;
  reason?: "closed" | "no_fit" | "fully_booked";
};

export async function getAvailability(params: {
  serviceId: string;
  locationId: string;
  technicianId: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  from: Date;
  to: Date;
  googleCalendarId?: string;
}): Promise<SlotResult[]> {
  const {
    serviceId,
    locationId,
    technicianId,
    durationMin,
    bufferBeforeMin,
    bufferAfterMin,
    from,
    to,
    googleCalendarId,
  } = params;

  // Load global rules
  const [rules] = await db.select().from(dk_booking_rules).limit(1);
  const {
    slot_step_min: stepMin,
    lead_time_hours: leadHours,
    buffers_inside_working_hours: buffersInside,
  } = rules ?? {
    slot_step_min: 30,
    lead_time_hours: 24,
    buffers_inside_working_hours: true,
  };

  const now = new Date();
  const leadCutoff = new Date(now.getTime() + leadHours * 60 * 60 * 1000);

  // Load working hours for the technician
  const workingHours = await db
    .select()
    .from(dk_working_hours)
    .where(
      and(
        eq(dk_working_hours.technician_id, technicianId),
        lte(dk_working_hours.valid_from, to.toISOString().slice(0, 10)),
      )
    );

  // Load exceptions in the window
  const exceptions = await db
    .select()
    .from(dk_exceptions)
    .where(
      and(
        eq(dk_exceptions.technician_id, technicianId),
        gte(dk_exceptions.date, from.toISOString().slice(0, 10)),
        lte(dk_exceptions.date, to.toISOString().slice(0, 10))
      )
    );

  // Load existing reservations that overlap the window (active only)
  const existingReservations = await db
    .select()
    .from(dk_reservations)
    .where(
      and(
        eq(dk_reservations.technician_id, technicianId),
        notInArray(dk_reservations.status, ["cancelled", "completed", "no_show", "rejected"]),
        lte(dk_reservations.blocks_from, to),
        gte(dk_reservations.blocks_to, from)
      )
    );

  // Load active slot holds
  const holds = await db
    .select()
    .from(dk_slot_holds)
    .where(
      and(
        eq(dk_slot_holds.technician_id, technicianId),
        gte(dk_slot_holds.expires_at, now),
        lte(dk_slot_holds.starts_at, to),
        gte(dk_slot_holds.ends_at, from)
      )
    );

  // Fetch Google freebusy (cached 60s in the route handler)
  let googleBusy: Array<{ start: string; end: string }> = [];
  if (googleCalendarId) {
    try {
      googleBusy = await queryGoogleFreebusy(googleCalendarId, from, to);
    } catch {
      // Non-fatal — fall back to DB-only availability
    }
  }

  const results: SlotResult[] = [];
  const cur = new Date(from);

  while (cur <= to) {
    const dateStr = cur.toISOString().slice(0, 10);
    const weekday = cur.getDay(); // 0=Sun…6=Sat

    // Resolve working hours: exception > most recent working hours row
    const exception = exceptions.find((e) => e.date === dateStr);
    let dayOpen = false;
    let opensAt: string | null | undefined = null;
    let closesAt: string | null | undefined = null;

    if (exception) {
      dayOpen = exception.is_open;
      opensAt = exception.opens_at;
      closesAt = exception.closes_at;
    } else {
      // Find the most recent valid_from row for this weekday
      const rows = workingHours
        .filter(
          (w) =>
            w.weekday === weekday &&
            w.valid_from <= dateStr &&
            (!w.valid_to || w.valid_to >= dateStr)
        )
        .sort((a, b) => b.valid_from.localeCompare(a.valid_from));

      const row = rows[0];
      if (row) {
        dayOpen = row.is_open;
        opensAt = row.opens_at;
        closesAt = row.closes_at;
      }
    }

    if (!dayOpen || !opensAt || !closesAt) {
      results.push({ date: dateStr, slots: [], closed: true, reason: "closed" });
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    // Build busy intervals for this day
    const busy: Array<[Date, Date]> = [];

    for (const r of existingReservations) {
      busy.push([new Date(r.blocks_from), new Date(r.blocks_to)]);
    }

    for (const h of holds) {
      const hStart = new Date(h.starts_at);
      const hEnd = new Date(h.ends_at);
      // Treat the hold's footprint with the same buffer math
      busy.push([
        new Date(hStart.getTime() - bufferBeforeMin * 60000),
        new Date(hEnd.getTime() + bufferAfterMin * 60000),
      ]);
    }

    for (const g of googleBusy) {
      busy.push([new Date(g.start), new Date(g.end)]);
    }

    // Parse open/close as UTC by combining with the date string
    const openDt = parsePragueTime(dateStr, opensAt);
    const closeDt = parsePragueTime(dateStr, closesAt);

    const totalBlockMin = bufferBeforeMin + durationMin + bufferAfterMin;
    if (totalBlockMin > minutesBetween(openDt, closeDt)) {
      results.push({ date: dateStr, slots: [], closed: false, reason: "no_fit" });
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    // Walk the slot grid
    const slots: string[] = [];
    let t = new Date(openDt);

    while (true) {
      const slotEnd = new Date(t.getTime() + durationMin * 60000);
      const footprintStart = new Date(t.getTime() - bufferBeforeMin * 60000);
      const footprintEnd = new Date(slotEnd.getTime() + bufferAfterMin * 60000);

      if (slotEnd > closeDt) break;

      // Check buffers fit inside working hours
      if (buffersInside && (footprintStart < openDt || footprintEnd > closeDt)) {
        t = new Date(t.getTime() + stepMin * 60000);
        continue;
      }

      // Lead time check
      if (t < leadCutoff) {
        t = new Date(t.getTime() + stepMin * 60000);
        continue;
      }

      // Overlap check
      const overlaps = busy.some(
        ([bStart, bEnd]) => footprintStart < bEnd && footprintEnd > bStart
      );

      if (!overlaps) {
        slots.push(t.toISOString());
      }

      t = new Date(t.getTime() + stepMin * 60000);
    }

    results.push({
      date: dateStr,
      slots,
      closed: false,
      reason: slots.length === 0 ? "fully_booked" : undefined,
    });

    cur.setDate(cur.getDate() + 1);
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parse a TIME string ("08:30") in Europe/Prague, return as UTC Date on the given date.
function parsePragueTime(dateStr: string, timeStr: string): Date {
  // Use the Intl API to get the Prague UTC offset for the given date.
  const naive = new Date(`${dateStr}T${timeStr}:00`);
  // Cheap but correct for our purposes: format the date in Prague timezone and
  // compute the offset from UTC.
  const pragueStr = naive.toLocaleString("en-CA", { timeZone: "Europe/Prague", hour12: false });
  const pragueDate = new Date(pragueStr + " UTC");
  const offsetMs = pragueDate.getTime() - naive.getTime();
  return new Date(naive.getTime() - offsetMs);
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}
