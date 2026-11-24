/**
 * Google Calendar push notification receiver — spec §7.
 *
 * Google POSTs to this endpoint when any event on a watched calendar changes.
 * We validate the channel header, pull the incremental changes and apply
 * them to dk_reservations immediately (see src/lib/gcal-sync.ts). The new
 * sync token is stored only after every event was processed, so the nightly
 * reconcile cron picks up anything that failed here.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../db";
import { dk_google_watch_channels, dk_technicians } from "../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { listEventsSince } from "../../../../../lib/google-calendar";
import { processCalendarEvents } from "../../../../../lib/gcal-sync";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("X-Goog-Channel-ID");
  const resourceState = req.headers.get("X-Goog-Resource-State");

  if (!channelId) {
    return new NextResponse(null, { status: 200 });
  }

  // 'sync' is the initial notification when a channel is created — safe to ignore
  if (resourceState === "sync") {
    return new NextResponse(null, { status: 200 });
  }

  const [channel] = await db
    .select()
    .from(dk_google_watch_channels)
    .where(eq(dk_google_watch_channels.channel_id, channelId))
    .limit(1);

  if (!channel) {
    return new NextResponse(null, { status: 200 });
  }

  const [technician] = await db
    .select()
    .from(dk_technicians)
    .where(eq(dk_technicians.id, channel.technician_id))
    .limit(1);

  if (!technician?.google_calendar_id) {
    return new NextResponse(null, { status: 200 });
  }

  try {
    const { events, nextSyncToken, gone } = await listEventsSince(
      technician.google_calendar_id,
      channel.sync_token,
      technician.id
    );

    if (gone) {
      // Sync token expired — leave the full re-sync to the reconcile cron
      // rather than pulling a ±180-day window inside a push request.
      return new NextResponse(null, { status: 200 });
    }

    const { report, failed } = await processCalendarEvents(technician, events);
    if (report.length) console.info("[google-webhook]", JSON.stringify(report));

    // Only advance the token once everything was applied; otherwise the next
    // push (or the nightly cron) re-reads the same changes. Processing is idempotent.
    if (nextSyncToken && failed === 0) {
      await db
        .update(dk_google_watch_channels)
        .set({ sync_token: nextSyncToken })
        .where(eq(dk_google_watch_channels.id, channel.id));
    }
  } catch (err) {
    console.error("Google webhook sync failed", err);
  }

  return new NextResponse(null, { status: 200 });
}
