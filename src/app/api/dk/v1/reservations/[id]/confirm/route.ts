import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import { dk_reservations, dk_account_users, dk_reservation_events } from "../../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [row] = await db
    .select()
    .from(dk_reservations)
    .where(eq(dk_reservations.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [membership] = await db
    .select()
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.account_id, row.account_id),
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.status !== "pending") {
    return NextResponse.json({ error: "Rezervace není ve stavu čekající na potvrzení." }, { status: 409 });
  }

  await db
    .update(dk_reservations)
    .set({ status: "confirmed", updated_at: new Date() })
    .where(eq(dk_reservations.id, id));

  await db.insert(dk_reservation_events).values({
    reservation_id: id,
    actor: `user:${session.userId}`,
    type: "confirmed",
  });

  return NextResponse.json({ ok: true });
}
