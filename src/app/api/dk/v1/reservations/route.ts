import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../db";
import {
  dk_reservations,
  dk_services,
  dk_locations,
  dk_technicians,
  dk_accounts,
  dk_account_users,
  dk_reservation_events,
  dk_slot_holds,
  dk_booking_rules,
} from "../../../../../../db/schema";
import { eq, and, or, desc, asc, gt, lt, notInArray } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../lib/auth";
import { createCalendarEvent } from "../../../../../lib/google-calendar";
import {
  sendReservationConfirmation,
} from "../../../../../lib/email";

export const dynamic = "force-dynamic";

// ─── GET /dk/v1/reservations?scope=upcoming|past&page= ───────────────────────

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const scope = searchParams.get("scope") ?? "upcoming";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const perPage = 20;

  // Resolve which accounts the user belongs to
  const memberships = await db
    .select({ account_id: dk_account_users.account_id })
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.status, "active")
      )
    );

  if (memberships.length === 0) {
    return NextResponse.json({ data: [], meta: { page, perPage, total: 0 } });
  }

  const accountIds = memberships.map((m) => m.account_id);
  const now = new Date();

  const conditions = [
    ...accountIds.map((id) => eq(dk_reservations.account_id, id)),
  ];

  // Build scope filter
  let rows = await db
    .select()
    .from(dk_reservations)
    .where(
      and(
        or(...conditions),
        scope === "upcoming"
          ? gt(dk_reservations.starts_at, now)
          : lt(dk_reservations.starts_at, now)
      )
    )
    .orderBy(
      scope === "upcoming"
        ? asc(dk_reservations.starts_at)
        : desc(dk_reservations.starts_at)
    )
    .offset((page - 1) * perPage)
    .limit(perPage);

  return NextResponse.json({
    data: rows,
    meta: { page, perPage },
  });
}

// ─── POST /dk/v1/reservations ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idempotencyKey = req.headers.get("Idempotency-Key");

  let body: {
    serviceId: string;
    locationId: string;
    startsAt: string;
    requesterName: string;
    requesterPhone: string;
    patientName?: string;
    note?: string;
    holdToken?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { serviceId, locationId, startsAt, requesterName, requesterPhone } =
    body;

  if (!serviceId || !locationId || !startsAt || !requesterName || !requesterPhone) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const start = new Date(startsAt);
  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid startsAt" }, { status: 400 });
  }

  // Validate the account is active
  const [membership] = await db
    .select({
      account_id: dk_account_users.account_id,
      account_status: dk_accounts.status,
    })
    .from(dk_account_users)
    .innerJoin(dk_accounts, eq(dk_accounts.id, dk_account_users.account_id))
    .where(
      and(
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "No active account" }, { status: 403 });
  }

  if (membership.account_status !== "active") {
    return NextResponse.json(
      { error: "Account pending approval — reservations not yet available" },
      { status: 403 }
    );
  }

  // Validate service
  const [service] = await db
    .select()
    .from(dk_services)
    .where(
      and(eq(dk_services.id, serviceId), eq(dk_services.active, true))
    )
    .limit(1);

  if (!service || !service.bookable_online) {
    return NextResponse.json({ error: "Service not available" }, { status: 404 });
  }

  // Validate location belongs to this account
  const [location] = await db
    .select()
    .from(dk_locations)
    .where(
      and(
        eq(dk_locations.id, locationId),
        eq(dk_locations.account_id, membership.account_id)
      )
    )
    .limit(1);

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  // Lead time check
  const [rules] = await db.select().from(dk_booking_rules).limit(1);
  const leadHours = rules?.lead_time_hours ?? 24;
  const leadCutoff = new Date(Date.now() + leadHours * 60 * 60 * 1000);

  if (start < leadCutoff) {
    return NextResponse.json(
      { error: "Slot is inside the lead-time window" },
      { status: 409 }
    );
  }

  // Find an available technician
  const [technician] = await db
    .select()
    .from(dk_technicians)
    .where(eq(dk_technicians.active, true))
    .limit(1);

  if (!technician) {
    return NextResponse.json(
      { error: "No technicians available" },
      { status: 503 }
    );
  }

  const end = new Date(start.getTime() + service.duration_min * 60000);
  const blocksFrom = new Date(
    start.getTime() - service.buffer_before_min * 60000
  );
  const blocksTo = new Date(
    end.getTime() + service.buffer_after_min * 60000
  );

  const status =
    service.requires_approval ? "pending" : "confirmed";

  // Insert reservation — the EXCLUDE constraint guarantees no overlap
  let reservationId: string;
  try {
    const [inserted] = await db
      .insert(dk_reservations)
      .values({
        account_id: membership.account_id,
        location_id: locationId,
        service_id: serviceId,
        technician_id: technician.id,
        created_by_user_id: session.userId,
        starts_at: start,
        ends_at: end,
        blocks_from: blocksFrom,
        blocks_to: blocksTo,
        status,
        requester_name: requesterName,
        requester_phone: requesterPhone,
        patient_name: body.patientName ?? null,
        note: body.note ?? null,
      })
      .returning({ id: dk_reservations.id });

    reservationId = inserted.id;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("dk_reservations_no_overlap")) {
      return NextResponse.json(
        { error: "Slot no longer available" },
        { status: 409 }
      );
    }
    throw err;
  }

  // Audit event
  await db.insert(dk_reservation_events).values({
    reservation_id: reservationId,
    actor: `user:${session.userId}`,
    type: "created",
    to_json: JSON.stringify({ status }),
  });

  // Expire the slot hold if one was provided
  if (body.holdToken) {
    await db
      .delete(dk_slot_holds)
      .where(eq(dk_slot_holds.session_token, body.holdToken));
  }

  // Sync to Google Calendar (async, non-blocking on failure — queued for retry)
  if (technician.google_calendar_id) {
    syncToGoogleCalendar({
      reservationId,
      calendarId: technician.google_calendar_id,
      serviceName: service.name,
      location,
      start,
      end,
      requesterName,
      requesterPhone,
      patientName: body.patientName,
    }).catch(console.error);
  }

  return NextResponse.json({ id: reservationId, status }, { status: 201 });
}

// ─── Background Google sync helper ───────────────────────────────────────────

async function syncToGoogleCalendar(params: {
  reservationId: string;
  calendarId: string;
  serviceName: string;
  location: { label: string; street: string; city: string; zip: string; access_note: string | null; contact_name: string | null; contact_phone: string | null };
  start: Date;
  end: Date;
  requesterName: string;
  requesterPhone: string;
  patientName?: string;
}) {
  const {
    reservationId,
    calendarId,
    serviceName,
    location,
    start,
    end,
    requesterName,
    requesterPhone,
    patientName,
  } = params;

  const address = `${location.street}, ${location.zip} ${location.city}`;
  const descLines = [
    `Objednal: ${requesterName}, ${requesterPhone}`,
    patientName ? `Pacient: ${patientName}` : null,
    location.access_note ? `Přístup: ${location.access_note}` : null,
    `Detail: ${process.env.NEXT_PUBLIC_APP_URL}/portal/rezervace/${reservationId}`,
  ].filter(Boolean);

  try {
    const { eventId, etag, iCalUID } = await createCalendarEvent(calendarId, {
      reservationId,
      summary: `${serviceName} — ${location.label}`,
      location: address,
      description: descLines.join("\n"),
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    });

    await db
      .update(dk_reservations)
      .set({
        google_event_id: eventId,
        google_etag: etag,
        google_ical_uid: iCalUID,
        google_calendar_id: calendarId,
        updated_at: new Date(),
      })
      .where(eq(dk_reservations.id, reservationId));

    await db.insert(dk_reservation_events).values({
      reservation_id: reservationId,
      actor: "system",
      type: "synced",
      to_json: JSON.stringify({ google_event_id: eventId }),
    });
  } catch (err) {
    console.error("Google Calendar sync failed for", reservationId, err);
    // Retry job will pick this up via the reconciliation cron
  }
}
