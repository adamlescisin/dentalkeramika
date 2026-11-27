/**
 * Legacy migration wizard — everything the client needs to build the mapping:
 * existing users (with their practices), practices' locations, services,
 * technicians, remembered mappings, and which legacy IDs are already imported.
 *
 * POST { legacyIds: number[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import {
  dk_users,
  dk_account_users,
  dk_accounts,
  dk_locations,
  dk_services,
  dk_technicians,
  dk_reservations,
  dk_legacy_mappings,
} from "../../../../../../../../db/schema";
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { legacyIds?: unknown };
  const legacyIds = Array.isArray(body.legacyIds)
    ? body.legacyIds.filter((n): n is number => Number.isSafeInteger(n))
    : [];

  try {
    const [users, memberships, accounts, locations, services, technicians, mappings, migrated] = await Promise.all([
      db
        .select({
          id: dk_users.id,
          email: dk_users.email,
          first_name: dk_users.first_name,
          last_name: dk_users.last_name,
          phone: dk_users.phone,
        })
        .from(dk_users)
        .orderBy(asc(dk_users.email)),
      db
        .select({
          user_id: dk_account_users.user_id,
          account_id: dk_account_users.account_id,
          role: dk_account_users.role,
        })
        .from(dk_account_users)
        .where(ne(dk_account_users.status, "removed")),
      db
        .select({
          id: dk_accounts.id,
          name: dk_accounts.name,
          status: dk_accounts.status,
          default_location_id: dk_accounts.default_location_id,
        })
        .from(dk_accounts)
        .orderBy(asc(dk_accounts.name)),
      db
        .select({
          id: dk_locations.id,
          account_id: dk_locations.account_id,
          label: dk_locations.label,
          street: dk_locations.street,
          city: dk_locations.city,
          zip: dk_locations.zip,
          is_default: dk_locations.is_default,
        })
        .from(dk_locations)
        .orderBy(asc(dk_locations.label)),
      db
        .select({
          id: dk_services.id,
          code: dk_services.code,
          name: dk_services.name,
          duration_min: dk_services.duration_min,
          buffer_before_min: dk_services.buffer_before_min,
          buffer_after_min: dk_services.buffer_after_min,
          active: dk_services.active,
        })
        .from(dk_services)
        .orderBy(asc(dk_services.code)),
      db
        .select({
          id: dk_technicians.id,
          display_name: dk_technicians.display_name,
          active: dk_technicians.active,
          has_calendar: sql<boolean>`${dk_technicians.google_calendar_id} IS NOT NULL`,
          has_hours: sql<boolean>`EXISTS (SELECT 1 FROM dk_working_hours WHERE technician_id = ${dk_technicians.id})`,
        })
        .from(dk_technicians),
      db.select().from(dk_legacy_mappings),
      legacyIds.length
        ? db
            .select({
              legacy_id: dk_reservations.legacy_bookly_appointment_id,
              id: dk_reservations.id,
              starts_at: dk_reservations.starts_at,
              status: dk_reservations.status,
              account_name: dk_accounts.name,
            })
            .from(dk_reservations)
            .innerJoin(dk_accounts, eq(dk_accounts.id, dk_reservations.account_id))
            .where(
              and(
                isNotNull(dk_reservations.legacy_bookly_appointment_id),
                inArray(dk_reservations.legacy_bookly_appointment_id, legacyIds)
              )
            )
        : Promise.resolve([]),
    ]);

    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();

    const defaultTech =
      [...technicians]
        .filter((t) => t.active)
        .sort((a, b) => Number(b.has_hours) - Number(a.has_hours) || Number(b.has_calendar) - Number(a.has_calendar))[0] ?? null;

    return NextResponse.json({
      now: new Date().toISOString(),
      users: users.map((u) => ({
        id: u.id,
        email: u.email.toLowerCase(),
        name: `${u.first_name} ${u.last_name}`.trim(),
        phone: u.phone,
        isAdmin: !!adminEmail && u.email.toLowerCase() === adminEmail,
        accounts: memberships
          .filter((m) => m.user_id === u.id && accountById.has(m.account_id))
          .map((m) => ({ id: m.account_id, name: accountById.get(m.account_id)!.name, role: m.role })),
      })),
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        defaultLocationId: a.default_location_id,
        locations: locations.filter((l) => l.account_id === a.id),
      })),
      services,
      technicians: technicians.map(({ id, display_name, active, has_calendar }) => ({ id, display_name, active, has_calendar })),
      defaultTechnicianId: defaultTech?.id ?? null,
      mappings: {
        customer: Object.fromEntries(
          mappings
            .filter((m) => m.kind === "customer")
            .map((m) => [m.legacy_key, { userId: m.target_id, accountId: m.target_account_id }])
        ),
        service: Object.fromEntries(
          mappings.filter((m) => m.kind === "service").map((m) => [m.legacy_key, m.target_id])
        ),
      },
      migrated: Object.fromEntries(
        migrated.map((m) => [
          String(m.legacy_id),
          { reservationId: m.id, startsAt: m.starts_at, status: m.status, accountName: m.account_name },
        ])
      ),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("dk_legacy_mappings") && msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Chybí databázová migrace: spusťte db/migrations/0004_legacy_migration.sql." },
        { status: 500 }
      );
    }
    throw err;
  }
}
