/**
 * Nightly Google ↔ Postgres reconciliation — spec §7.
 *
 * For each active technician:
 *   1. Pull incremental events since last sync token (or full ±180-day window on GONE)
 *   2. For each event: find matching dk_reservation by google_event_id
 *      - Time change → update reservation, emit 'rescheduled' by actor 'google'
 *      - Delete → 10-min grace re-read; if still missing → cancel
 *      - Event with no reservation → log to report (manual triage)
 *   3. Renew watch channel if expiring within 48 h
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../db";
import {
  dk_technicians,
  dk_reservations,
  dk_google_watch_channels,
  dk_reservation_events,
} from "../../../../../db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import {
  listEventsSince,
  registerWatchChannel,
  stopWatchChannel,
} from "../../../../lib/google-calendar";
import { randomUUID } from "crypto";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (CRON_SECRET && req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const technicians = await db
    .select()
    .from(dk_technicians)
    .where(eq(dk_technicians.active, true));

  const report: Record<string, unknown>[] = [];

  for (const tech of technicians) {
    if (!tech.google_calendar_id) continue;

    // Load current sync state
    const [channel] = await db
      .select()
      .from(dk_google_watch_channels)
      .where(eq(dk_google_watch_channels.technician_id, tech.id))
      .limit(1);

    const { events, nextSyncToken, gone } = await listEventsSince(
      tech.google_calendar_id,
      channel?.sync_token ?? null
    );

    if (gone || !channel) {
      report.push({
        technician: tech.display_name,
        action: "full_resync",
        reason: gone ? "GONE" : "no_channel",
      });
    }

    if (nextSyncToken && channel) {
      await db
        .update(dk_google_watch_channels)
        .set({ sync_token: nextSyncToken })
        .where(eq(dk_google_watch_channels.id, channel.id));
    }

    for (const event of events) {
      if (!event.id) continue;

      const [reservation] = await db
        .select()
        .from(dk_reservations)
        .where(eq(dk_reservations.google_event_id, event.id))
        .limit(1);

      if (!reservation) {
        // Event exists in calendar but no matching reservation — log for triage
        report.push({
          technician: tech.display_name,
          google_event_id: event.id,
          issue: "event_without_reservation",
          summary: event.summary,
          start: event.start?.dateTime,
        });
        continue;
      }

      // Deleted event
      if (event.status === "cancelled") {
        if (
          ["cancelled", "completed", "no_show"].includes(reservation.status)
        ) {
          continue; // Already terminal, nothing to do
        }

        // 10-minute grace: check if the event is really gone
        // (in a nightly job we don't have 10 minutes, but we do a second read)
        const secondRead = await listEventsSince(
          tech.google_calendar_id!,
          null,
          new Date(event.start?.dateTime ?? Date.now()),
          new Date(event.end?.dateTime ?? Date.now())
        );

        const stillGone = !secondRead.events.find(
          (e) => e.id === event.id && e.status !== "cancelled"
        );

        if (stillGone) {
          await db
            .update(dk_reservations)
            .set({ status: "cancelled", cancelled_at: new Date(), updated_at: new Date() })
            .where(eq(dk_reservations.id, reservation.id));

          await db.insert(dk_reservation_events).values({
            reservation_id: reservation.id,
            actor: "google",
            type: "cancelled",
            to_json: JSON.stringify({ reason: "Google Calendar event deleted" }),
          });

          report.push({
            technician: tech.display_name,
            reservation_id: reservation.id,
            action: "cancelled_from_gcal",
          });
        }
        continue;
      }

      // Time change
      const gcalStart = event.start?.dateTime;
      if (gcalStart) {
        const gcalStartDt = new Date(gcalStart);
        const diff = Math.abs(
          gcalStartDt.getTime() - reservation.starts_at.getTime()
        );

        if (diff > 60_000) {
          // More than 1 minute difference — technician moved it
          const oldStart = reservation.starts_at;
          await db
            .update(dk_reservations)
            .set({
              starts_at: gcalStartDt,
              google_etag: event.etag ?? null,
              updated_at: new Date(),
            })
            .where(eq(dk_reservations.id, reservation.id));

          await db.insert(dk_reservation_events).values({
            reservation_id: reservation.id,
            actor: "google",
            type: "rescheduled",
            from_json: JSON.stringify({ starts_at: oldStart }),
            to_json: JSON.stringify({ starts_at: gcalStartDt }),
          });

          report.push({
            technician: tech.display_name,
            reservation_id: reservation.id,
            action: "rescheduled_from_gcal",
            old_start: oldStart,
            new_start: gcalStartDt,
          });
        }
      }
    }

    // Renew watch channel if expiring within 48 hours
    const expiringSoon =
      channel &&
      new Date(channel.expires_at).getTime() < Date.now() + 48 * 60 * 60 * 1000;

    if (!channel || expiringSoon) {
      try {
        const channelId = randomUUID();
        const { resourceId, expiration } = await registerWatchChannel(
          tech.google_calendar_id,
          channelId,
          `${process.env.NEXT_PUBLIC_APP_URL}/api/dk/v1/google-webhook`
        );

        if (channel && expiringSoon) {
          // Stop the old channel
          stopWatchChannel(channel.channel_id, channel.resource_id ?? "").catch(
            console.error
          );

          await db
            .update(dk_google_watch_channels)
            .set({
              channel_id: channelId,
              resource_id: resourceId,
              sync_token: nextSyncToken ?? channel.sync_token,
              expires_at: expiration,
            })
            .where(eq(dk_google_watch_channels.id, channel.id));
        } else {
          await db.insert(dk_google_watch_channels).values({
            technician_id: tech.id,
            channel_id: channelId,
            resource_id: resourceId,
            sync_token: nextSyncToken ?? null,
            expires_at: expiration,
          });
        }
      } catch (err) {
        report.push({
          technician: tech.display_name,
          issue: "watch_renewal_failed",
          error: String(err),
        });
      }
    }
  }

  return NextResponse.json({ ok: true, report });
}
