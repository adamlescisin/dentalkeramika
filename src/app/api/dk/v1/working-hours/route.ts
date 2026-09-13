import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../db";
import { dk_technicians, dk_working_hours } from "../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminSession } from "../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const technicians = await db.select().from(dk_technicians).where(eq(dk_technicians.active, true));
  const hours = await db.select().from(dk_working_hours);
  return NextResponse.json({ technicians, hours });
}

export async function PUT(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  type DayRow = { weekday: number; is_open: boolean; opens_at: string | null; closes_at: string | null };
  const { technicianId, days }: { technicianId: string; days: DayRow[] } = await req.json();

  if (!technicianId || !Array.isArray(days) || days.length !== 7) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [tech] = await db
    .select({ id: dk_technicians.id })
    .from(dk_technicians)
    .where(and(eq(dk_technicians.id, technicianId), eq(dk_technicians.active, true)))
    .limit(1);

  if (!tech) return NextResponse.json({ error: "Technician not found" }, { status: 404 });

  await db.delete(dk_working_hours).where(eq(dk_working_hours.technician_id, technicianId));

  const today = new Date().toISOString().slice(0, 10);
  await db.insert(dk_working_hours).values(
    days.map((d) => ({
      technician_id: technicianId,
      weekday: d.weekday,
      is_open: d.is_open,
      opens_at: d.is_open ? (d.opens_at ?? "08:00") : null,
      closes_at: d.is_open ? (d.closes_at ?? "17:00") : null,
      valid_from: today,
    }))
  );

  return NextResponse.json({ ok: true });
}
