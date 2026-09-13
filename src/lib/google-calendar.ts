/**
 * Google Calendar integration — OAuth2 per-technician tokens.
 *
 * Auth: standard OAuth2 (Client ID + Client Secret).
 * Each technician connects their own Google account via the /portal/admin/google-connect
 * flow. Tokens (access + refresh) are stored encrypted in dk_oauth_tokens and refreshed
 * automatically on each call. This scales to N technicians with individual calendars.
 */

import { OAuth2Client } from "google-auth-library";
import { google, calendar_v3 } from "googleapis";
import { db } from "../../db";
import { dk_oauth_tokens } from "../../db/schema";
import { eq } from "drizzle-orm";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// ─── Token encryption ─────────────────────────────────────────────────────────
// Tokens are encrypted at rest with AES-256-GCM using OAUTH_ENCRYPTION_KEY.

const ALGO = "aes-256-gcm" as const;

function getEncryptionKey(): Buffer {
  const raw = process.env.OAUTH_ENCRYPTION_KEY;
  if (!raw) throw new Error("OAUTH_ENCRYPTION_KEY is not set");
  return scryptSync(raw, "dk-oauth-salt", 32);
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ─── OAuth2 client factory ────────────────────────────────────────────────────

export function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/dk/v1/google-oauth/callback`
  );
}

export function getAuthorizationUrl(technicianId: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh token on first connect
    scope: ["https://www.googleapis.com/auth/calendar"],
    state: technicianId,
  });
}

// ─── Token management ─────────────────────────────────────────────────────────

export async function saveTokensForTechnician(
  technicianId: string,
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null | undefined
): Promise<void> {
  await db
    .insert(dk_oauth_tokens)
    .values({
      technician_id: technicianId,
      access_token_enc: encryptToken(accessToken),
      refresh_token_enc: encryptToken(refreshToken),
      expires_at: expiryDate ? new Date(expiryDate) : null,
    })
    .onConflictDoUpdate({
      target: dk_oauth_tokens.technician_id,
      set: {
        access_token_enc: encryptToken(accessToken),
        refresh_token_enc: encryptToken(refreshToken),
        expires_at: expiryDate ? new Date(expiryDate) : null,
        updated_at: new Date(),
      },
    });
}

async function getAuthClientForTechnician(technicianId: string): Promise<OAuth2Client> {
  const [row] = await db
    .select()
    .from(dk_oauth_tokens)
    .where(eq(dk_oauth_tokens.technician_id, technicianId))
    .limit(1);

  if (!row) {
    throw new Error(`No Google OAuth tokens for technician ${technicianId}. Connect via admin panel.`);
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: decryptToken(row.access_token_enc),
    refresh_token: decryptToken(row.refresh_token_enc),
    expiry_date: row.expires_at ? row.expires_at.getTime() : undefined,
  });

  // Auto-refresh if expired or expiring within 5 minutes
  const expiry = row.expires_at ? row.expires_at.getTime() : 0;
  if (!expiry || expiry < Date.now() + 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken();
    await saveTokensForTechnician(
      technicianId,
      credentials.access_token!,
      credentials.refresh_token ?? decryptToken(row.refresh_token_enc),
      credentials.expiry_date
    );
    client.setCredentials(credentials);
  }

  // Persist updated tokens if the client auto-refreshed during the call
  client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await saveTokensForTechnician(
        technicianId,
        tokens.access_token,
        tokens.refresh_token ?? decryptToken(row.refresh_token_enc),
        tokens.expiry_date
      );
    }
  });

  return client;
}

function getCalendar(auth: OAuth2Client) {
  return google.calendar({ version: "v3", auth });
}

// ─── Freebusy ─────────────────────────────────────────────────────────────────

export async function queryGoogleFreebusy(
  calendarId: string,
  from: Date,
  to: Date,
  technicianId: string
): Promise<Array<{ start: string; end: string }>> {
  const auth = await getAuthClientForTechnician(technicianId);
  const cal = getCalendar(auth);

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  return (res.data.calendars?.[calendarId]?.busy ?? []).map((i) => ({
    start: i.start!,
    end: i.end!,
  }));
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
  technicianId: string
): Promise<{ eventId: string; etag: string; iCalUID: string }> {
  const auth = await getAuthClientForTechnician(technicianId);
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
  technicianId: string
): Promise<{ etag: string }> {
  const auth = await getAuthClientForTechnician(technicianId);
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

  // Pass If-Match via GaxiosOptions as a second argument so TypeScript is happy.
  const patchOptions = payload.etag
    ? { headers: { "If-Match": payload.etag } }
    : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (cal.events.patch as any)(
    { calendarId, eventId, sendUpdates: "none", requestBody: body },
    patchOptions
  );
  return { etag: res.data.etag! };
}

export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string,
  technicianId: string
): Promise<void> {
  const auth = await getAuthClientForTechnician(technicianId);
  const cal = getCalendar(auth);

  await cal.events.delete({ calendarId, eventId, sendUpdates: "none" });
}

// Adopt an existing Bookly event by stamping our extended properties onto it.
// Leaves summary, time and attendees untouched; sendUpdates=none.
export async function adoptCalendarEvent(
  calendarId: string,
  eventId: string,
  reservationId: string,
  technicianId: string
): Promise<{ etag: string }> {
  return patchCalendarEvent(
    calendarId,
    eventId,
    { reservationId, version: 2 },
    technicianId
  );
}

// ─── Push notification channels ───────────────────────────────────────────────

export async function registerWatchChannel(
  calendarId: string,
  channelId: string,
  webhookUrl: string,
  technicianId: string
): Promise<{ resourceId: string; expiration: Date }> {
  const auth = await getAuthClientForTechnician(technicianId);
  const cal = getCalendar(auth);

  const res = await cal.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
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
  technicianId: string
): Promise<void> {
  const auth = await getAuthClientForTechnician(technicianId);
  const cal = getCalendar(auth);

  await cal.channels.stop({ requestBody: { id: channelId, resourceId } });
}

// ─── Incremental sync ─────────────────────────────────────────────────────────

export async function listEventsSince(
  calendarId: string,
  syncToken: string | null,
  technicianId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<{
  events: calendar_v3.Schema$Event[];
  nextSyncToken: string | null;
  gone: boolean;
}> {
  const auth = await getAuthClientForTechnician(technicianId);
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
    if ((err as { code?: number }).code === 410) {
      return { events: [], nextSyncToken: null, gone: true };
    }
    throw err;
  }
}

// ─── Calendar list ───────────────────────────────────────────────────────────

export async function listTechnicianCalendars(
  technicianId: string
): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const auth = await getAuthClientForTechnician(technicianId);
  const cal = getCalendar(auth);
  const res = await cal.calendarList.list({ minAccessRole: "writer" });
  return (res.data.items ?? []).map((c) => ({
    id: c.id!,
    summary: c.summary ?? c.id!,
    primary: !!c.primary,
  }));
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
