import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../../db";
import { dk_technicians } from "../../../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const calendarId = typeof body.calendarId === "string" ? body.calendarId.trim() : null;

  if (!calendarId) return NextResponse.json({ error: "calendarId required" }, { status: 400 });

  const [updated] = await db
    .update(dk_technicians)
    .set({ google_calendar_id: calendarId })
    .where(eq(dk_technicians.id, id))
    .returning({ id: dk_technicians.id, google_calendar_id: dk_technicians.google_calendar_id });

  if (!updated) return NextResponse.json({ error: "Technician not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}
