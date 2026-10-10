import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import {
  dk_reservations,
  dk_reservation_events,
  dk_services,
  dk_locations,
  dk_technicians,
  dk_users,
} from "../../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../lib/admin-auth";
import { sendReservationConfirmation } from "../../../../../../../lib/email";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [row] = await db.select().from(dk_reservations).where(eq(dk_reservations.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Rezervace není ve stavu čekající na potvrzení." }, { status: 409 });
  }

  await db.update(dk_reservations).set({ status: "confirmed", updated_at: new Date() }).where(eq(dk_reservations.id, id));
  await db.insert(dk_reservation_events).values({ reservation_id: id, actor: `admin:${session.userId}`, type: "confirmed" });

  // Await the email so Vercel doesn't terminate the function before Resend responds.
  try {
    await sendConfirmationEmail(row);
  } catch (err) {
    console.error("[confirm] email failed for reservation", id, err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true });
}

async function sendConfirmationEmail(row: typeof dk_reservations.$inferSelect) {
  const [[service], [location], [technician], [user]] = await Promise.all([
    db.select().from(dk_services).where(eq(dk_services.id, row.service_id)).limit(1),
    db.select().from(dk_locations).where(eq(dk_locations.id, row.location_id)).limit(1),
    row.technician_id
      ? db.select().from(dk_technicians).where(eq(dk_technicians.id, row.technician_id)).limit(1)
      : Promise.resolve([undefined]),
    db.select({ email: dk_users.email }).from(dk_users).where(eq(dk_users.id, row.created_by_user_id!)).limit(1),
  ]);

  if (!service || !location || !technician || !user) {
    console.warn("[confirm] missing related data for reservation", row.id);
    return;
  }

  await sendReservationConfirmation({
    email: user.email,
    accountName: "",
    serviceName: service.name,
    startsAt: row.starts_at,
    locationLabel: location.label,
    locationAddress: `${location.street}, ${location.zip} ${location.city}`,
    technicianName: technician.display_name,
    reservationId: row.id,
  });
}
