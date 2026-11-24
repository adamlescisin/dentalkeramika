import { db } from "../../db";
import {
  dk_reservations,
  dk_services,
  dk_locations,
  dk_accounts,
  dk_technicians,
  dk_users,
} from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  sendReservationChangeToPractice,
  sendReservationChangeToTechnician,
  type ReservationChangeKind,
} from "./email";

type Reservation = typeof dk_reservations.$inferSelect;

/**
 * Sends the change e-mail to the practice (reservation creator + whoever made the
 * change, if a different practice user) and to the assigned technician.
 * Never throws — a failed e-mail must not roll back the change itself.
 */
export async function notifyReservationChange(params: {
  reservation: Reservation;
  kind: ReservationChangeKind;
  oldStartsAt?: Date;
  reason?: string | null;
  changedBy: string;
  actorUserId?: string;
}): Promise<void> {
  const { reservation: r } = params;
  try {
    const userIds = [r.created_by_user_id, params.actorUserId].filter((v): v is string => !!v);

    const [[service], [location], [account], [technician], users] = await Promise.all([
      db.select().from(dk_services).where(eq(dk_services.id, r.service_id)).limit(1),
      db.select().from(dk_locations).where(eq(dk_locations.id, r.location_id)).limit(1),
      db.select().from(dk_accounts).where(eq(dk_accounts.id, r.account_id)).limit(1),
      r.technician_id
        ? db.select().from(dk_technicians).where(eq(dk_technicians.id, r.technician_id)).limit(1)
        : Promise.resolve([undefined]),
      userIds.length
        ? db.select({ id: dk_users.id, email: dk_users.email }).from(dk_users).where(inArray(dk_users.id, userIds))
        : Promise.resolve([] as { id: string; email: string }[]),
    ]);

    if (!service || !location) {
      console.warn("[notify] missing service/location for reservation", r.id);
      return;
    }

    let technicianEmail = technician?.email ?? null;
    if (!technicianEmail && technician?.user_id) {
      const [u] = await db.select({ email: dk_users.email }).from(dk_users).where(eq(dk_users.id, technician.user_id)).limit(1);
      technicianEmail = u?.email ?? null;
    }

    const practiceTo = Array.from(new Set(users.map((u) => u.email.toLowerCase())));
    const technicianTo = technicianEmail && !practiceTo.includes(technicianEmail.toLowerCase()) ? [technicianEmail] : [];

    const details = {
      kind: params.kind,
      reservationId: r.id,
      serviceName: service.name,
      accountName: account?.name ?? "",
      startsAt: r.starts_at,
      oldStartsAt: params.oldStartsAt,
      locationLabel: location.label,
      locationAddress: `${location.street}, ${location.zip} ${location.city}`,
      technicianName: technician?.display_name,
      requesterName: r.requester_name,
      requesterPhone: r.requester_phone,
      patientName: r.patient_name,
      note: r.note,
      reason: typeof params.reason === "string" && params.reason.trim() ? params.reason.trim() : null,
      changedBy: params.changedBy,
    };

    const results = await Promise.allSettled([
      sendReservationChangeToPractice(practiceTo, details),
      sendReservationChangeToTechnician(technicianTo, details),
    ]);
    for (const res of results) {
      if (res.status === "rejected") {
        console.error("[notify] e-mail failed for", r.id, res.reason instanceof Error ? res.reason.message : res.reason);
      }
    }
  } catch (err) {
    console.error("[notify] failed for", r.id, err instanceof Error ? err.message : err);
  }
}
