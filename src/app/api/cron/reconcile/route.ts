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
import { dk_technicians, dk_google_watch_channels } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import {
  listEventsSince,
  registerWatchChannel,
  stopWatchChannel,
} from "../../../../lib/google-calendar";
import { processCalendarEvents } from "../../../../lib/gcal-sync";
import { randomUUID } from "crypto";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (CRON_SECRET && req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Nejste přihlášeni. Přihlaste se prosím znovu." }, { status: 401 });
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

    let { events, nextSyncToken, gone } = await listEventsSince(
      tech.google_calendar_id,
      channel?.sync_token ?? null,
      tech.id
    );

    if (gone || !channel) {
      report.push({
        technician: tech.display_name,
        action: "full_resync",
        reason: gone ? "GONE" : "no_channel",
      });
    }

    if (gone) {
      // Sync token expired — fall back to a full ±180-day window to get a fresh token.
      ({ events, nextSyncToken, gone } = await listEventsSince(
        tech.google_calendar_id,
        null,
        tech.id
      ));
    }

    const result = await processCalendarEvents(tech, events);
    report.push(...result.report);

    // Advance the token only if every event was applied, so failures are retried.
    if (result.failed > 0) nextSyncToken = null;

    if (nextSyncToken && channel) {
      await db
        .update(dk_google_watch_channels)
        .set({ sync_token: nextSyncToken })
        .where(eq(dk_google_watch_channels.id, channel.id));
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
          `${process.env.NEXT_PUBLIC_APP_URL}/api/dk/v1/google-webhook`,
          tech.id
        );

        if (channel && expiringSoon) {
          // Stop the old channel
          stopWatchChannel(channel.channel_id, channel.resource_id ?? "", tech.id).catch(
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
