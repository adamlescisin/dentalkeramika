import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import { dk_account_users } from "../../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [callerMembership] = await db
    .select()
    .from(dk_account_users)
    .where(and(eq(dk_account_users.user_id, session.userId), eq(dk_account_users.status, "active")))
    .limit(1);

  if (!callerMembership || callerMembership.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [target] = await db
    .select()
    .from(dk_account_users)
    .where(and(eq(dk_account_users.id, id), eq(dk_account_users.account_id, callerMembership.account_id)))
    .limit(1);

  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.user_id === session.userId) {
    return NextResponse.json({ error: "Nemůžete odebrat sami sebe." }, { status: 400 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "Vlastníka nelze odebrat." }, { status: 400 });
  }

  await db.delete(dk_account_users).where(eq(dk_account_users.id, id));
  return NextResponse.json({ ok: true });
}
