import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../../lib/auth";
import { db } from "../../../../../../../db";
import { dk_account_users, dk_oauth_tokens, dk_technicians } from "../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.redirect(new URL("/prihlasit", req.url));
  }

  const [membership] = await db
    .select()
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.role, "owner"),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const technicianId = req.nextUrl.searchParams.get("technician_id");
  if (!technicianId) {
    return NextResponse.json({ error: "technician_id required" }, { status: 400 });
  }

  await db.delete(dk_oauth_tokens).where(eq(dk_oauth_tokens.technician_id, technicianId));

  // Clear the stored calendar ID so reconnect re-discovers it
  await db
    .update(dk_technicians)
    .set({ google_calendar_id: null })
    .where(eq(dk_technicians.id, technicianId));

  return NextResponse.redirect(
    new URL("/portal/admin/kalendar?disconnected=1", req.url)
  );
}
