import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import {
  dk_reservations,
  dk_services,
  dk_account_users,
  dk_reservation_events,
  dk_booking_rules,
  dk_technicians,
  dk_locations,
} from "../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../lib/auth";
import {
  patchCalendarEvent,
  deleteCalendarEvent,
} from "../../../../../../lib/google-calendar";
import {
  sendRescheduleConfirmation,
  sendCancellationConfirmation,
} from "../../../../../../lib/email";

export const dynamic = "force-dynamic";

async function getReservationForUser(id: string, userId: string) {
  // Load reservation and confirm the user's account owns it
  const [row] = await db
    .select()
    .from(dk_reservations)
    .where(eq(dk_reservations.id, id))
    .limit(1);

  if (!row) return null;

  const [membership] = await db
    .select()
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.account_id, row.account_id),
        eq(dk_account_users.user_id, userId),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership) return null;
  return { reservation: row, role: membership.role };
}

// ─── GET /dk/v1/reservations/:id ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await getReservationForUser(id, session.userId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: result.reservation });
}

// ─── PATCH /dk/v1/reservations/:id — reschedule ───────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await getReservationForUser(id, session.userId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { reservation, role } = result;

  if (role === "viewer") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (!["pending", "confirmed", "rescheduled"].includes(reservation.status)) {
    return NextResponse.json(
      { error: "Reservation cannot be rescheduled in its current state" },
      { status: 409 }
    );
  }

  // Reschedule self-service cut-off
  const [rules] = await db.select().from(dk_booking_rules).limit(1);
  const cutoffHours = rules?.reschedule_cutoff_hours ?? 24;
  const maxReschedules = rules?.max_self_reschedules ?? 2;
  const cutoff = new Date(
    reservation.starts_at.getTime() - cutoffHours * 60 * 60 * 1000
  );

  if (new Date() > cutoff) {
    return NextResponse.json(
      { error: "Inside cut-off window — please call us to reschedule" },
      { status: 409 }
    );
  }

  if ((reservation.reschedule_count ?? 0) >= maxReschedules) {
    return NextResponse.json(
      { error: "Self-service reschedule limit reached" },
      { status: 409 }
    );
  }

  let body: { starts_at: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newStart = new Date(body.starts_at);
  if (isNaN(newStart.getTime())) {
    return NextResponse.json({ error: "Invalid starts_at" }, { status: 400 });
  }

  const [service] = await db
    .select()
    .from(dk_services)
    .where(eq(dk_services.id, reservation.service_id))
    .limit(1);

  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 500 });

  const newEnd = new Date(newStart.getTime() + service.duration_min * 60000);
  const newBlocksFrom = new Date(
    newStart.getTime() - service.buffer_before_min * 60000
  );
  const newBlocksTo = new Date(
    newEnd.getTime() + service.buffer_after_min * 60000
  );

  const oldStart = reservation.starts_at;

  let updated: { id: string }[];
  try {
    updated = await db
      .update(dk_reservations)
      .set({
        starts_at: newStart,
        ends_at: newEnd,
        blocks_from: newBlocksFrom,
        blocks_to: newBlocksTo,
        status: "rescheduled",
        reschedule_count: (reservation.reschedule_count ?? 0) + 1,
        updated_at: new Date(),
      })
      .where(eq(dk_reservations.id, id))
      .returning({ id: dk_reservations.id });
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

  if (updated.length === 0) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  await db.insert(dk_reservation_events).values({
    reservation_id: id,
    actor: `user:${session.userId}`,
    type: "rescheduled",
    from_json: JSON.stringify({ starts_at: oldStart }),
    to_json: JSON.stringify({ starts_at: newStart }),
  });

  // Patch Google Calendar event (keep same event id per spec)
  if (reservation.google_event_id && reservation.google_calendar_id && reservation.technician_id) {
    patchCalendarEvent(
      reservation.google_calendar_id,
      reservation.google_event_id,
      {
        startIso: newStart.toISOString(),
        endIso: newEnd.toISOString(),
        etag: reservation.google_etag ?? undefined,
      },
      reservation.technician_id
    )
      .then(({ etag }) =>
        db
          .update(dk_reservations)
          .set({ google_etag: etag, updated_at: new Date() })
          .where(eq(dk_reservations.id, id))
      )
      .catch(console.error);
  }

  // Fetch location for email
  const [location] = await db
    .select()
    .from(dk_locations)
    .where(eq(dk_locations.id, reservation.location_id))
    .limit(1);

  return NextResponse.json({
    data: { id, status: "rescheduled", starts_at: newStart },
  });
}

// ─── DELETE /dk/v1/reservations/:id — cancel ─────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await getReservationForUser(id, session.userId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { reservation, role } = result;

  if (role === "viewer") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (!["pending", "confirmed", "rescheduled"].includes(reservation.status)) {
    return NextResponse.json(
      { error: "Reservation cannot be cancelled in its current state" },
      { status: 409 }
    );
  }

  const [rules] = await db.select().from(dk_booking_rules).limit(1);
  const cutoffHours = rules?.reschedule_cutoff_hours ?? 24;
  const cutoff = new Date(
    reservation.starts_at.getTime() - cutoffHours * 60 * 60 * 1000
  );

  if (new Date() > cutoff) {
    return NextResponse.json(
      { error: "Inside cut-off window — please call us to cancel" },
      { status: 409 }
    );
  }

  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = body.reason;
  } catch {
    // reason is optional
  }

  await db
    .update(dk_reservations)
    .set({
      status: "cancelled",
      cancelled_at: new Date(),
      cancel_reason: reason ?? null,
      updated_at: new Date(),
    })
    .where(eq(dk_reservations.id, id));

  await db.insert(dk_reservation_events).values({
    reservation_id: id,
    actor: `user:${session.userId}`,
    type: "cancelled",
    to_json: JSON.stringify({ reason }),
  });

  // Delete Google Calendar event (with 10-minute grace on the inbound webhook)
  if (reservation.google_event_id && reservation.google_calendar_id && reservation.technician_id) {
    deleteCalendarEvent(
      reservation.google_calendar_id,
      reservation.google_event_id,
      reservation.technician_id
    ).catch(console.error);
  }

  const [service] = await db
    .select()
    .from(dk_services)
    .where(eq(dk_services.id, reservation.service_id))
    .limit(1);

  return NextResponse.json({ data: { id, status: "cancelled" } });
}
