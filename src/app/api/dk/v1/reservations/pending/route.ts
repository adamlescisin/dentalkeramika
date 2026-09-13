import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_reservations, dk_services, dk_locations, dk_accounts } from "../../../../../../../db/schema";
import { eq, asc } from "drizzle-orm";
import { getAdminSession } from "../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
