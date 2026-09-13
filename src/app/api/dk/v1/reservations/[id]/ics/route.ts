import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import { dk_reservations, dk_services, dk_locations, dk_account_users } from "../../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../../lib/auth";

export const dynamic = "force-dynamic";

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  const [row] = await db
    .select({ r: dk_reservations, svc: dk_services, loc: dk_locations })
    .from(dk_reservations)
    .innerJoin(dk_services, eq(dk_services.id, dk_reservations.service_id))
    .innerJoin(dk_locations, eq(dk_locations.id, dk_reservations.location_id))
    .where(eq(dk_reservations.id, id))
    .limit(1);

  if (!row) return new NextResponse("Not found", { status: 404 });

  const [membership] = await db
    .select()
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.account_id, row.r.account_id),
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership) return new NextResponse("Forbidden", { status: 403 });

  const { r, svc, loc } = row;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dentalkeramika.cz";
  const uid = `rezervace-${r.id}@dentalkeramika.cz`;
  const locationStr = `${loc.street}, ${loc.city}`;
  const description = [
    svc.name,
    `Místo: ${loc.label} — ${locationStr}`,
    ...(loc.access_note ? [`Přístup: ${loc.access_note}`] : []),
    ...(r.patient_name ? [`Pacient: ${r.patient_name}`] : []),
    ...(r.note ? [`Poznámka: ${r.note}`] : []),
    `Detail: ${appUrl}/portal/rezervace/${r.id}`,
  ].join("\\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DentálníKeramika//CS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(new Date(r.starts_at))}`,
    `DTEND:${icsDate(new Date(r.ends_at))}`,
    `SUMMARY:${icsEscape(svc.name)} — DentálníKeramika`,
    `DESCRIPTION:${description}`,
    `LOCATION:${icsEscape(locationStr)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rezervace-${r.id.slice(0, 8)}.ics"`,
    },
  });
}
