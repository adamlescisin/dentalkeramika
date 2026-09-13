/**
 * Google Calendar push notification receiver — spec §7.
 *
 * Google POSTs to this endpoint when any event on a watched calendar changes.
 * We validate the channel header and trigger an incremental sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../db";
import { dk_google_watch_channels, dk_technicians } from "../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { listEventsSince } from "../../../../../lib/google-calendar";

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

  // Run incremental sync — the heavy lifting is in the reconcile cron;
  // here we just update the sync token so the next cron run picks up only
  // what we haven't seen since this push.
  try {
    const { nextSyncToken } = await listEventsSince(
      technician.google_calendar_id,
      channel.sync_token,
      technician.id
    );

    if (nextSyncToken) {
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
