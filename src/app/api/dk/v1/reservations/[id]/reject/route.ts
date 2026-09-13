import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import { dk_reservations, dk_reservation_events } from "../../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [row] = await db.select().from(dk_reservations).where(eq(dk_reservations.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Rezervace není ve stavu čekající na potvrzení." }, { status: 409 });
  }

  let reason: string | undefined;
  try { reason = (await req.json()).reason; } catch { /* optional */ }

  await db.update(dk_reservations).set({
    status: "rejected", cancel_reason: reason ?? null, cancelled_at: new Date(), updated_at: new Date(),
  }).where(eq(dk_reservations.id, id));

  await db.insert(dk_reservation_events).values({
    reservation_id: id, actor: `admin:${session.userId}`, type: "rejected",
    to_json: reason ? JSON.stringify({ reason }) : null,
  });

  return NextResponse.json({ ok: true });
}
