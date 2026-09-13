import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../../db";
import {
  dk_reservations,
  dk_services,
  dk_locations,
  dk_technicians,
  dk_accounts,
} from "../../../../../../../../../db/schema";
import { eq, desc } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [account] = await db
    .select({ id: dk_accounts.id, name: dk_accounts.name, status: dk_accounts.status, created_at: dk_accounts.created_at, approved_at: dk_accounts.approved_at, billing_email: dk_accounts.billing_email, ico: dk_accounts.ico })
    .from(dk_accounts)
    .where(eq(dk_accounts.id, id))
    .limit(1);

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: dk_reservations.id,
      starts_at: dk_reservations.starts_at,
      ends_at: dk_reservations.ends_at,
      status: dk_reservations.status,
      requester_name: dk_reservations.requester_name,
      requester_phone: dk_reservations.requester_phone,
      note: dk_reservations.note,
      created_at: dk_reservations.created_at,
      reschedule_count: dk_reservations.reschedule_count,
      service_name: dk_services.name,
      location_label: dk_locations.label,
      location_city: dk_locations.city,
      technician_name: dk_technicians.display_name,
    })
    .from(dk_reservations)
    .innerJoin(dk_services, eq(dk_reservations.service_id, dk_services.id))
    .innerJoin(dk_locations, eq(dk_reservations.location_id, dk_locations.id))
    .leftJoin(dk_technicians, eq(dk_reservations.technician_id, dk_technicians.id))
    .where(eq(dk_reservations.account_id, id))
    .orderBy(desc(dk_reservations.starts_at));

  return NextResponse.json({ account, data: rows });
}
