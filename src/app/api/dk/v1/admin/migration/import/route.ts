/**
 * Legacy migration wizard — validate (dryRun) or import a chunk of rows.
 *
 * The client sends rows with its mapping already applied (target user,
 * practice, location, service, status). Everything is re-validated here.
 *
 * Idempotent: a legacy ID that already exists in dk_reservations is reported
 * as "skipped_existing" — both by an up-front lookup and, for races, by the
 * unique index dk_reservations_legacy_bookly_idx.
 *
 * Sends no e-mails and creates no Google Calendar events.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "../../../../../../../../db";
import {
  dk_users,
  dk_account_users,
  dk_accounts,
  dk_locations,
  dk_services,
  dk_technicians,
  dk_reservations,
  dk_reservation_events,
  dk_legacy_mappings,
} from "../../../../../../../../db/schema";
import { and, eq, gt, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../lib/admin-auth";
import {
  normaliseLocalDateTime,
  pragueLocalToUtc,
  type DkStatus,
  type ImportRow,
  type ImportResult,
} from "../../../../../../../lib/legacy-csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: DkStatus[] = ["pending", "confirmed", "cancelled", "rejected", "completed"];
/** Statuses the dk_reservations_no_overlap constraint ignores. */
const NON_BLOCKING = ["cancelled", "completed", "no_show", "rejected"];
const MAX_ROWS = 5000;

interface Body {
  dryRun?: boolean;
  technicianId?: string;
  rows?: ImportRow[];
  rememberMappings?: {
    customer?: Record<string, { userId: string; accountId: string }>;
    service?: Record<string, string>;
  };
}

function errText(err: unknown): string {
  const parts: string[] = [];
  let e: unknown = err;
  for (let i = 0; e && i < 4; i++) {
    if (e instanceof Error) parts.push(e.message);
    const c = (e as { constraint?: string }).constraint;
    if (c) parts.push(c);
    e = (e as { cause?: unknown }).cause;
  }
  return parts.join(" | ");
}

const fmt = (d: Date) =>
  d.toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const dryRun = body.dryRun !== false;
  const rows = Array.isArray(body.rows)
    ? body.rows.filter((r): r is ImportRow => !!r && typeof r === "object")
    : [];

  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Najednou lze zpracovat nejvýše ${MAX_ROWS} řádků.` }, { status: 400 });
  }
  if (!body.technicianId || !UUID_RE.test(body.technicianId)) {
    return NextResponse.json({ error: "Vyberte technika." }, { status: 400 });
  }

  const [technician] = await db
    .select({ id: dk_technicians.id })
    .from(dk_technicians)
    .where(eq(dk_technicians.id, body.technicianId))
    .limit(1);
  if (!technician) return NextResponse.json({ error: "Technik nenalezen." }, { status: 400 });

  // ─── Remember mapping decisions (real run only) ─────────────────────────────
  if (!dryRun && body.rememberMappings) {
    await saveMappings(body.rememberMappings, session.userId);
  }

  if (rows.length === 0) return NextResponse.json({ results: [] });

  // ─── Load everything referenced by this chunk in a few queries ──────────────
  const ids = (k: "userId" | "accountId" | "locationId" | "serviceId") =>
    Array.from(new Set(rows.map((r) => r[k] as unknown).filter((v): v is string => typeof v === "string" && UUID_RE.test(v))));
  const legacyIds = rows.map((r) => r.legacyId).filter((n) => Number.isSafeInteger(n));
  const userIds = ids("userId");
  const accountIds = ids("accountId");
  const locationIds = ids("locationId");
  const serviceIds = ids("serviceId");

  const [existing, users, memberships, accounts, locations, services] = await Promise.all([
    legacyIds.length
      ? db
          .select({ legacy_id: dk_reservations.legacy_bookly_appointment_id, id: dk_reservations.id })
          .from(dk_reservations)
          .where(inArray(dk_reservations.legacy_bookly_appointment_id, legacyIds))
      : Promise.resolve([]),
    userIds.length
      ? db
          .select({ id: dk_users.id, first_name: dk_users.first_name, last_name: dk_users.last_name, phone: dk_users.phone })
          .from(dk_users)
          .where(inArray(dk_users.id, userIds))
      : Promise.resolve([]),
    userIds.length && accountIds.length
      ? db
          .select({ user_id: dk_account_users.user_id, account_id: dk_account_users.account_id })
          .from(dk_account_users)
          .where(
            and(
              inArray(dk_account_users.user_id, userIds),
              inArray(dk_account_users.account_id, accountIds),
              ne(dk_account_users.status, "removed")
            )
          )
      : Promise.resolve([]),
    accountIds.length
      ? db.select({ id: dk_accounts.id }).from(dk_accounts).where(inArray(dk_accounts.id, accountIds))
      : Promise.resolve([]),
    locationIds.length
      ? db
          .select({ id: dk_locations.id, account_id: dk_locations.account_id })
          .from(dk_locations)
          .where(inArray(dk_locations.id, locationIds))
      : Promise.resolve([]),
    serviceIds.length
      ? db.select().from(dk_services).where(inArray(dk_services.id, serviceIds))
      : Promise.resolve([]),
  ]);

  const existingByLegacy = new Map(existing.map((e) => [e.legacy_id!, e.id]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const memberSet = new Set(memberships.map((m) => `${m.user_id}:${m.account_id}`));
  const accountSet = new Set(accounts.map((a) => a.id));
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const serviceById = new Map(services.map((s) => [s.id, s]));

  // ─── Validate & compute times ───────────────────────────────────────────────
  type Prepared = {
    row: ImportRow;
    start: Date;
    end: Date;
    blocksFrom: Date;
    blocksTo: Date;
    blocking: boolean;
    requesterName: string;
    requesterPhone: string;
  };
  const results = new Map<number, ImportResult>();
  const prepared: Prepared[] = [];

  for (const row of rows) {
    const legacyId = row.legacyId;
    if (!Number.isSafeInteger(legacyId)) continue;
    const fail = (message: string) => results.set(legacyId, { legacyId, outcome: "error", message });

    const existingId = existingByLegacy.get(legacyId);
    if (existingId) {
      results.set(legacyId, { legacyId, outcome: "skipped_existing", reservationId: existingId, message: "Již migrováno." });
      continue;
    }

    const local = typeof row.startsLocal === "string" ? normaliseLocalDateTime(row.startsLocal) : null;
    if (!local) { fail("Neplatné datum."); continue; }
    const user = userById.get(row.userId);
    if (!user) { fail("Cílový uživatel neexistuje."); continue; }
    if (!accountSet.has(row.accountId)) { fail("Ordinace neexistuje."); continue; }
    if (!memberSet.has(`${row.userId}:${row.accountId}`)) { fail("Uživatel není členem vybrané ordinace."); continue; }
    const location = locationById.get(row.locationId);
    if (!location || location.account_id !== row.accountId) { fail("Místo nepatří k vybrané ordinaci."); continue; }
    const service = serviceById.get(row.serviceId);
    if (!service) { fail("Služba neexistuje."); continue; }
    if (!STATUSES.includes(row.status)) { fail("Neplatný stav."); continue; }

    const duration =
      Number.isSafeInteger(row.durationMin) && (row.durationMin as number) > 0 && (row.durationMin as number) <= 24 * 60
        ? (row.durationMin as number)
        : service.duration_min;
    const start = pragueLocalToUtc(local);
    const end = new Date(start.getTime() + duration * 60000);

    prepared.push({
      row,
      start,
      end,
      blocksFrom: new Date(start.getTime() - service.buffer_before_min * 60000),
      blocksTo: new Date(end.getTime() + service.buffer_after_min * 60000),
      blocking: !NON_BLOCKING.includes(row.status),
      requesterName: (String(row.requesterName ?? "").trim() || `${user.first_name} ${user.last_name}`.trim() || "—").slice(0, 120),
      requesterPhone: (String(row.requesterPhone ?? "").trim() || user.phone || "—").slice(0, 32),
    });
  }

  // ─── Overlap pre-check (mirrors dk_reservations_no_overlap) ────────────────
  const blockingRows = prepared.filter((p) => p.blocking);
  if (blockingRows.length) {
    const minFrom = new Date(Math.min(...blockingRows.map((p) => p.blocksFrom.getTime())));
    const maxTo = new Date(Math.max(...blockingRows.map((p) => p.blocksTo.getTime())));
    const occupied = await db
      .select({
        id: dk_reservations.id,
        starts_at: dk_reservations.starts_at,
        blocks_from: dk_reservations.blocks_from,
        blocks_to: dk_reservations.blocks_to,
        legacy_id: dk_reservations.legacy_bookly_appointment_id,
      })
      .from(dk_reservations)
      .where(
        and(
          eq(dk_reservations.technician_id, technician.id),
          notInArray(dk_reservations.status, NON_BLOCKING as ("cancelled" | "completed" | "no_show" | "rejected")[]),
          lt(dk_reservations.blocks_from, maxTo),
          gt(dk_reservations.blocks_to, minFrom)
        )
      );

    const taken: { from: number; to: number; label: string }[] = occupied.map((o) => ({
      from: o.blocks_from.getTime(),
      to: o.blocks_to.getTime(),
      label: o.legacy_id ? `rezervací Bookly #${o.legacy_id} (${fmt(o.starts_at)})` : `rezervací v portálu (${fmt(o.starts_at)})`,
    }));

    for (const p of blockingRows) {
      const clash = taken.find((t) => p.blocksFrom.getTime() < t.to && t.from < p.blocksTo.getTime());
      if (clash) {
        results.set(p.row.legacyId, {
          legacyId: p.row.legacyId,
          outcome: "error",
          message: `Překrývá se (včetně časových rezerv služby) s ${clash.label}.`,
        });
      } else {
        taken.push({ from: p.blocksFrom.getTime(), to: p.blocksTo.getTime(), label: `rezervací Bookly #${p.row.legacyId} z tohoto importu (${fmt(p.start)})` });
      }
    }
  }

  // ─── Import (or report what would be imported) ──────────────────────────────
  for (const p of prepared) {
    const { row } = p;
    if (results.has(row.legacyId)) continue; // overlap error

    if (dryRun) {
      results.set(row.legacyId, { legacyId: row.legacyId, outcome: "would_import" });
      continue;
    }

    const reservationId = randomUUID();
    const now = new Date();
    try {
      await db.batch([
        db.insert(dk_reservations).values({
          id: reservationId,
          account_id: row.accountId,
          location_id: row.locationId,
          service_id: row.serviceId,
          technician_id: technician.id,
          created_by_user_id: row.userId,
          starts_at: p.start,
          ends_at: p.end,
          blocks_from: p.blocksFrom,
          blocks_to: p.blocksTo,
          status: row.status,
          requester_name: p.requesterName,
          requester_phone: p.requesterPhone,
          note: String(row.notes ?? "").trim() || null,
          legacy_bookly_appointment_id: row.legacyId,
          cancelled_at: row.status === "cancelled" ? now : null,
          cancel_reason:
            row.status === "cancelled"
              ? "Zrušeno v původním rezervačním systému (Bookly)."
              : row.status === "rejected"
                ? "Zamítnuto v původním rezervačním systému (Bookly)."
                : null,
        }),
        db.insert(dk_reservation_events).values({
          reservation_id: reservationId,
          actor: `migration:${session.userId}`,
          type: "created",
          to_json: JSON.stringify({ source: "bookly", status: row.status, legacy: row.legacy }),
        }),
      ]);
      results.set(row.legacyId, { legacyId: row.legacyId, outcome: "imported", reservationId });
    } catch (err) {
      const msg = errText(err);
      if (msg.includes("dk_reservations_legacy_bookly_idx")) {
        results.set(row.legacyId, { legacyId: row.legacyId, outcome: "skipped_existing", message: "Již migrováno." });
      } else if (msg.includes("dk_reservations_no_overlap")) {
        results.set(row.legacyId, { legacyId: row.legacyId, outcome: "error", message: "Překrývá se s jinou aktivní rezervací technika." });
      } else {
        console.error("[migration] insert failed", row.legacyId, err);
        results.set(row.legacyId, { legacyId: row.legacyId, outcome: "error", message: `Chyba databáze: ${msg.slice(0, 300)}` });
      }
    }
  }

  return NextResponse.json({
    results: rows
      .filter((r) => Number.isSafeInteger(r.legacyId))
      .map((r) => results.get(r.legacyId) ?? { legacyId: r.legacyId, outcome: "error", message: "Neplatný řádek." }),
  });
}

async function saveMappings(m: NonNullable<Body["rememberMappings"]>, adminUserId: string) {
  const customer = Object.entries(m.customer ?? {}).filter(
    ([k, v]) => k && k.length <= 255 && v && UUID_RE.test(v.userId) && UUID_RE.test(v.accountId)
  );
  const service = Object.entries(m.service ?? {}).filter(([k, v]) => k && k.length <= 255 && UUID_RE.test(v));

  // Only keep mappings whose targets still exist and are consistent.
  const [members, svc] = await Promise.all([
    customer.length
      ? db
          .select({ user_id: dk_account_users.user_id, account_id: dk_account_users.account_id })
          .from(dk_account_users)
          .where(
            and(
              inArray(dk_account_users.user_id, customer.map(([, v]) => v.userId)),
              ne(dk_account_users.status, "removed")
            )
          )
      : Promise.resolve([]),
    service.length
      ? db.select({ id: dk_services.id }).from(dk_services).where(inArray(dk_services.id, service.map(([, v]) => v)))
      : Promise.resolve([]),
  ]);
  const memberSet = new Set(members.map((x) => `${x.user_id}:${x.account_id}`));
  const svcSet = new Set(svc.map((x) => x.id));

  const values = [
    ...customer
      .filter(([, v]) => memberSet.has(`${v.userId}:${v.accountId}`))
      .map(([k, v]) => ({ kind: "customer", legacy_key: k, target_id: v.userId, target_account_id: v.accountId, updated_by: adminUserId })),
    ...service
      .filter(([, v]) => svcSet.has(v))
      .map(([k, v]) => ({ kind: "service", legacy_key: k, target_id: v, target_account_id: null, updated_by: adminUserId })),
  ];
  if (!values.length) return;

  await db
    .insert(dk_legacy_mappings)
    .values(values)
    .onConflictDoUpdate({
      target: [dk_legacy_mappings.kind, dk_legacy_mappings.legacy_key],
      set: {
        target_id: sql`excluded.target_id`,
        target_account_id: sql`excluded.target_account_id`,
        updated_by: sql`excluded.updated_by`,
        updated_at: sql`now()`,
      },
    });
}
