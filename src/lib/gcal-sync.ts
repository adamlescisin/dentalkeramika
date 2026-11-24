/**
 * Applies Google Calendar changes to dk_reservations — spec §7.
 *
 * Shared by the push webhook (/api/dk/v1/google-webhook) and the nightly
 * reconcile cron (/api/cron/reconcile). Both fetch events via
 * listEventsSince() and hand them here BEFORE advancing the stored sync
 * token, so no change is consumed without being applied.
 *
 * Processing is idempotent: a reservation already matching the event (or
 * already terminal) is left alone, so re-processing the same batch is safe.
 */

import type { calendar_v3 } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  dk_reservations,
  dk_reservation_events,
  dk_services,
  dk_technicians,
} from "../../db/schema";
import { getCalendarEvent } from "./google-calendar";
import { notifyReservationChange } from "./reservation-notify";

type Technician = typeof dk_technicians.$inferSelect;

const TERMINAL_STATUSES = ["cancelled", "completed", "no_show"];
const GCAL_ACTOR_LABEL = "technik (Google kalendář)";
/** Differences below this are treated as rounding noise, not a move. */
const TIME_TOLERANCE_MS = 60_000;

export interface GcalSyncResult {
  report: Record<string, unknown>[];
  /** Number of events whose processing threw. Callers should not advance the sync token if > 0. */
  failed: number;
}

export async function processCalendarEvents(
  tech: Technician,
  events: calendar_v3.Schema$Event[]
): Promise<GcalSyncResult> {
  const report: Record<string, unknown>[] = [];
  let failed = 0;

  for (const event of events) {
    if (!event.id) continue;
    try {
      const entry = await processEvent(tech, event);
      if (entry) report.push({ technician: tech.display_name, ...entry });
    } catch (err) {
      failed++;
      console.error("[gcal-sync] failed to process event", event.id, err);
      report.push({
        technician: tech.display_name,
        google_event_id: event.id,
        issue: "processing_failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { report, failed };
}

async function processEvent(
  tech: Technician,
  event: calendar_v3.Schema$Event
): Promise<Record<string, unknown> | null> {
  const eventId = event.id!;

  const [reservation] = await db
    .select()
    .from(dk_reservations)
    .where(eq(dk_reservations.google_event_id, eventId))
    .limit(1);

  if (!reservation) {
    // Cancelled events with no reservation are just noise from the technician's calendar.
    if (event.status === "cancelled") return null;
    return {
      google_event_id: eventId,
      issue: "event_without_reservation",
      summary: event.summary,
      start: event.start?.dateTime,
    };
  }

  if (TERMINAL_STATUSES.includes(reservation.status)) return null;

  // ─── Deleted event ─────────────────────────────────────────────────────────
  if (event.status === "cancelled") {
    // Grace check: re-read the event directly. If it has come back (undo,
    // move to another calendar and back), leave the reservation alone.
    const calendarId = reservation.google_calendar_id ?? tech.google_calendar_id!;
    const secondRead = await getCalendarEvent(calendarId, eventId, tech.id);
    if (secondRead && secondRead.status !== "cancelled") {
      return { reservation_id: reservation.id, action: "delete_ignored_event_restored" };
    }

    const cancelledAt = new Date();
    await db
      .update(dk_reservations)
      .set({ status: "cancelled", cancelled_at: cancelledAt, updated_at: cancelledAt })
      .where(eq(dk_reservations.id, reservation.id));

    await db.insert(dk_reservation_events).values({
      reservation_id: reservation.id,
      actor: "google",
      type: "cancelled",
      to_json: JSON.stringify({ reason: "Google Calendar event deleted" }),
    });

    await notifyReservationChange({
      reservation: { ...reservation, status: "cancelled", cancelled_at: cancelledAt },
      kind: "cancelled",
      changedBy: GCAL_ACTOR_LABEL,
    });

    return { reservation_id: reservation.id, action: "cancelled_from_gcal" };
  }

  // ─── Time change ───────────────────────────────────────────────────────────
  const gcalStartIso = event.start?.dateTime;
  if (!gcalStartIso) return null; // all-day or malformed — not something we booked

  const newStart = new Date(gcalStartIso);
  const startMoved =
    Math.abs(newStart.getTime() - reservation.starts_at.getTime()) > TIME_TOLERANCE_MS;
  const gcalEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null;
  const endMoved =
    !!gcalEnd &&
    Math.abs(gcalEnd.getTime() - reservation.ends_at.getTime()) > TIME_TOLERANCE_MS;

  if (!startMoved && !endMoved) return null;

  const [service] = await db
    .select()
    .from(dk_services)
    .where(eq(dk_services.id, reservation.service_id))
    .limit(1);

  if (!service) throw new Error(`Service ${reservation.service_id} not found`);

  // Google is ground truth for the visit window; buffers come from the service,
  // computed the same way as the portal's PATCH reschedule.
  const newEnd = gcalEnd ?? new Date(newStart.getTime() + service.duration_min * 60000);
  const newBlocksFrom = new Date(newStart.getTime() - service.buffer_before_min * 60000);
  const newBlocksTo = new Date(newEnd.getTime() + service.buffer_after_min * 60000);

  const oldStart = reservation.starts_at;
  const oldEnd = reservation.ends_at;

  try {
    await db
      .update(dk_reservations)
      .set({
        starts_at: newStart,
        ends_at: newEnd,
        blocks_from: newBlocksFrom,
        blocks_to: newBlocksTo,
        status: "rescheduled",
        google_etag: event.etag ?? null,
        updated_at: new Date(),
      })
      .where(eq(dk_reservations.id, reservation.id));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("dk_reservations_no_overlap")) {
      // The technician moved the event onto another reservation's buffers.
      // We can't store it without violating the EXCLUDE constraint — flag it
      // for manual triage instead of failing the whole batch.
      return {
        reservation_id: reservation.id,
        issue: "gcal_move_conflicts_with_other_reservation",
        old_start: oldStart,
        new_start: newStart,
      };
    }
    throw err;
  }

  await db.insert(dk_reservation_events).values({
    reservation_id: reservation.id,
    actor: "google",
    type: "rescheduled",
    from_json: JSON.stringify({ starts_at: oldStart, ends_at: oldEnd }),
    to_json: JSON.stringify({ starts_at: newStart, ends_at: newEnd }),
  });

  await notifyReservationChange({
    reservation: {
      ...reservation,
      starts_at: newStart,
      ends_at: newEnd,
      blocks_from: newBlocksFrom,
      blocks_to: newBlocksTo,
      status: "rescheduled",
    },
    kind: "rescheduled",
    oldStartsAt: oldStart,
    changedBy: GCAL_ACTOR_LABEL,
  });

  return {
    reservation_id: reservation.id,
    action: "rescheduled_from_gcal",
    old_start: oldStart,
    new_start: newStart,
  };
}
