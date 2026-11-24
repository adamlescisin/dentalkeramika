import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../db";
import { dk_services, dk_technicians } from "../../../../../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getAvailability } from "../../../../../lib/availability";
import { getSessionFromCookies } from "../../../../../lib/auth";

// Cache availability per (service, technician, day) for 60 seconds.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nejste přihlášeni. Přihlaste se prosím znovu." }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const serviceId = searchParams.get("service");
  const locationId = searchParams.get("location");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const technicianId = searchParams.get("technician");

  if (!serviceId || !locationId || !fromParam || !toParam) {
    return NextResponse.json(
      { error: "Chybí povinné údaje (služba, adresa nebo období)." },
      { status: 400 }
    );
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Neplatný rozsah dat." }, { status: 400 });
  }

  // Horizon guard
  const maxHorizon = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  if (to > maxHorizon) {
    return NextResponse.json(
      { error: "Termíny lze vyhledávat nejvýše 90 dní dopředu." },
      { status: 400 }
    );
  }

  const [service] = await db
    .select()
    .from(dk_services)
    .where(and(eq(dk_services.id, serviceId), eq(dk_services.active, true)))
    .limit(1);

  if (!service) {
    return NextResponse.json({ error: "Služba nebyla nalezena." }, { status: 404 });
  }

  if (!service.bookable_online) {
    return NextResponse.json(
      { error: "Tuto službu nelze rezervovat online. Kontaktujte nás prosím telefonicky." },
      { status: 400 }
    );
  }

  // Pick technician: either the requested one, or the first active technician
  let resolvedTechnicianId = technicianId;
  let googleCalendarId: string | undefined;

  if (resolvedTechnicianId) {
    const [tech] = await db
      .select()
      .from(dk_technicians)
      .where(
        and(
          eq(dk_technicians.id, resolvedTechnicianId),
          eq(dk_technicians.active, true)
        )
      )
      .limit(1);
    if (!tech) {
      return NextResponse.json(
        { error: "Technik nebyl nalezen." },
        { status: 404 }
      );
    }
    googleCalendarId = tech.google_calendar_id ?? undefined;
  } else {
    // Pick the best-configured active technician:
    // 1. Must have working hours (otherwise they can never show slots)
    // 2. Among those, prefer ones with Google Calendar connected
    const [tech] = await db
      .select()
      .from(dk_technicians)
      .where(eq(dk_technicians.active, true))
      .orderBy(
        sql`(EXISTS (SELECT 1 FROM dk_working_hours WHERE technician_id = ${dk_technicians.id})) DESC`,
        sql`CASE WHEN ${dk_technicians.google_calendar_id} IS NOT NULL THEN 0 ELSE 1 END`
      )
      .limit(1);
    if (!tech) {
      return NextResponse.json(
        { error: "Momentálně není k dispozici žádný technik. Kontaktujte nás prosím telefonicky." },
        { status: 503 }
      );
    }
    resolvedTechnicianId = tech.id;
    googleCalendarId = tech.google_calendar_id ?? undefined;
  }

  const slots = await getAvailability({
    serviceId,
    locationId,
    technicianId: resolvedTechnicianId,
    durationMin: service.duration_min,
    bufferBeforeMin: service.buffer_before_min,
    bufferAfterMin: service.buffer_after_min,
    from,
    to,
    googleCalendarId,
  });

  return NextResponse.json(
    { data: slots },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=30",
      },
    }
  );
}
