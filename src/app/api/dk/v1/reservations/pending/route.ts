import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import {
  dk_reservations,
  dk_services,
  dk_locations,
  dk_accounts,
  dk_account_users,
} from "../../../../../../../db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../lib/auth";

export const dynamic = "force-dynamic";

// GET /api/dk/v1/reservations/pending
// Owner-only: returns all pending (requires_approval) reservations across the system.
export async function GET(_req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [membership] = await db
    .select()
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: dk_reservations.id,
      starts_at: dk_reservations.starts_at,
      ends_at: dk_reservations.ends_at,
      requester_name: dk_reservations.requester_name,
      note: dk_reservations.note,
      created_at: dk_reservations.created_at,
      service_name: dk_services.name,
      location_label: dk_locations.label,
      location_city: dk_locations.city,
      account_name: dk_accounts.name,
    })
    .from(dk_reservations)
    .innerJoin(dk_services, eq(dk_services.id, dk_reservations.service_id))
    .innerJoin(dk_locations, eq(dk_locations.id, dk_reservations.location_id))
    .innerJoin(dk_accounts, eq(dk_accounts.id, dk_reservations.account_id))
    .where(eq(dk_reservations.status, "pending"))
    .orderBy(asc(dk_reservations.starts_at));

  return NextResponse.json({ data: rows });
}
