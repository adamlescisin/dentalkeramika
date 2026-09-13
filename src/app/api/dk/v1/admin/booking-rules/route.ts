import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_booking_rules } from "../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [row] = await db.select().from(dk_booking_rules).where(eq(dk_booking_rules.id, 1)).limit(1);
  return NextResponse.json({ data: row ?? null });
}

export async function PATCH(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const allowed = ["slot_step_min", "lead_time_hours", "buffers_inside_working_hours",
                   "reschedule_cutoff_hours", "max_self_reschedules", "horizon_days"] as const;
  const patch: Partial<typeof dk_booking_rules.$inferInsert> = {};
  for (const key of allowed) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  // Upsert the single row (id=1)
  await db
    .insert(dk_booking_rules)
    .values({ id: 1, ...patch } as typeof dk_booking_rules.$inferInsert)
    .onConflictDoUpdate({ target: dk_booking_rules.id, set: patch });

  const [updated] = await db.select().from(dk_booking_rules).where(eq(dk_booking_rules.id, 1)).limit(1);
  return NextResponse.json({ data: updated });
}
