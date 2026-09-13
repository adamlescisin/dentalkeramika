/**
 * Google Calendar integration — spec §7.
 *
 * Auth: Google Workspace service account with domain-wide delegation,
 * impersonating each technician's Workspace address.
 * Tokens are obtained via the service account JWT flow; they do not expire
 * because a user revoked an OAuth consent.
 */

import { GoogleAuth } from "google-auth-library";
import { google, calendar_v3 } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function getAuth(impersonateEmail?: string) {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "{}");
  return new GoogleAuth({
    credentials,
    scopes: SCOPES,
    clientOptions: impersonateEmail
      ? { subject: impersonateEmail }
      : undefined,
  });
}

function getCalendar(auth: GoogleAuth) {
  return google.calendar({ version: "v3", auth: auth as Parameters<typeof google.calendar>[0]["auth"] });
}

// ─── Freebusy ─────────────────────────────────────────────────────────────────

export async function queryGoogleFreebusy(
  calendarId: string,
  from: Date,
  to: Date,
  impersonateEmail?: string
): Promise<Array<{ start: string; end: string }>> {
  const auth = getAuth(impersonateEmail);
  const cal = getCalendar(auth);

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const intervals = res.data.calendars?.[calendarId]?.busy ?? [];
  return intervals.map((i) => ({ start: i.start!, end: i.end! }));
}

// ─── Event management ─────────────────────────────────────────────────────────

export interface DkEventPayload {
  reservationId: string;
  summary: string;
  location: string;
  description: string;
  startIso: string;
  endIso: string;
  version?: number;
}

export async function createCalendarEvent(
  calendarId: string,
  payload: DkEventPayload,
  impersonateEmail?: string
): Promise<{ eventId: string; etag: string; iCalUID: string }> {
  const auth = getAuth(impersonateEmail);
  const cal = getCalendar(auth);

  const event = await cal.events.insert({
    calendarId,
    sendUpdates: "none",
    requestBody: buildEventBody(payload),
  });

  return {
    eventId: event.data.id!,
    etag: event.data.etag!,
    iCalUID: event.data.iCalUID!,
  };
}

export async function patchCalendarEvent(
  calendarId: string,
  eventId: string,
  payload: Partial<DkEventPayload> & { etag?: string },
  impersonateEmail?: string
): Promise<{ etag: string }> {
  const auth = getAuth(impersonateEmail);
  const cal = getCalendar(auth);

  const body: calendar_v3.Schema$Event = {};
  if (payload.summary) body.summary = payload.summary;
  if (payload.location) body.location = payload.location;
  if (payload.description) body.description = payload.description;
  if (payload.startIso)
    body.start = { dateTime: payload.startIso, timeZone: "Europe/Prague" };
  if (payload.endIso)
    body.end = { dateTime: payload.endIso, timeZone: "Europe/Prague" };
  if (payload.reservationId) {
    body.extendedProperties = {
      private: {
        dk_reservation_id: payload.reservationId,
        dk_version: String(payload.version ?? 2),
      },
    };
  }

  const res = await cal.events.patch({
    calendarId,
    eventId,
    sendUpdates: "none",
    // Optimistic concurrency: if the etag changed (technician edited), return 412
    ...(payload.etag ? { headers: { "If-Match": payload.etag } } : {}),
    requestBody: body,
  });

  return { etag: res.data.etag! };
}

export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string,
  impersonateEmail?: string
): Promise<void> {
  const auth = getAuth(impersonateEmail);
  const cal = getCalendar(auth);

  await cal.events.delete({
    calendarId,
    eventId,
    sendUpdates: "none",
  });
}

// Adopt an existing Bookly event by stamping our extended properties onto it.
// Leaves summary, time and attendees untouched; sendUpdates=none.
export async function adoptCalendarEvent(
  calendarId: string,
  eventId: string,
  reservationId: string,
  impersonateEmail?: string
): Promise<{ etag: string }> {
  return patchCalendarEvent(
    calendarId,
    eventId,
    { reservationId, version: 2 },
    impersonateEmail
  );
}

// ─── Push notification channels ───────────────────────────────────────────────

export async function registerWatchChannel(
  calendarId: string,
  channelId: string,
  webhookUrl: string,
  impersonateEmail?: string
): Promise<{ resourceId: string; expiration: Date }> {
  const auth = getAuth(impersonateEmail);
  const cal = getCalendar(auth);

  const res = await cal.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      // 7 days (maximum Google allows)
      expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    resourceId: res.data.resourceId!,
    expiration: new Date(Number(res.data.expiration)),
  };
}

export async function stopWatchChannel(
  channelId: string,
  resourceId: string,
  impersonateEmail?: string
): Promise<void> {
  const auth = getAuth(impersonateEmail);
  const cal = getCalendar(auth);

  await cal.channels.stop({
    requestBody: { id: channelId, resourceId },
  });
}

// ─── Incremental sync ─────────────────────────────────────────────────────────

export async function listEventsSince(
  calendarId: string,
  syncToken: string | null,
  fromDate?: Date,
  toDate?: Date,
  impersonateEmail?: string
): Promise<{
  events: calendar_v3.Schema$Event[];
  nextSyncToken: string | null;
  gone: boolean;
}> {
  const auth = getAuth(impersonateEmail);
  const cal = getCalendar(auth);

  try {
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      singleEvents: true,
      showDeleted: true,
      ...(syncToken
        ? { syncToken }
        : {
            timeMin: (fromDate ?? new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)).toISOString(),
            timeMax: (toDate ?? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)).toISOString(),
          }),
    };

    const events: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;

    do {
      const res = await cal.events.list({ ...params, pageToken });
      events.push(...(res.data.items ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? null;
    } while (pageToken);

    return { events, nextSyncToken, gone: false };
  } catch (err: unknown) {
    const status = (err as { code?: number }).code;
    if (status === 410) {
      // GONE — sync token expired, do a full re-sync
      return { events: [], nextSyncToken: null, gone: true };
    }
    throw err;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEventBody(payload: DkEventPayload): calendar_v3.Schema$Event {
  return {
    summary: payload.summary,
    location: payload.location,
    description: payload.description,
    start: { dateTime: payload.startIso, timeZone: "Europe/Prague" },
    end: { dateTime: payload.endIso, timeZone: "Europe/Prague" },
    extendedProperties: {
      private: {
        dk_reservation_id: payload.reservationId,
        dk_version: String(payload.version ?? 2),
      },
    },
  };
}
