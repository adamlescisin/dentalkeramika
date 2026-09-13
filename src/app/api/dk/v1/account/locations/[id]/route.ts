import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import { dk_account_users, dk_locations } from "../../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../../lib/auth";

export const dynamic = "force-dynamic";

async function getOwnerAccount(userId: string) {
  const [m] = await db
    .select({ accountId: dk_account_users.account_id, role: dk_account_users.role })
    .from(dk_account_users)
    .where(and(eq(dk_account_users.user_id, userId), eq(dk_account_users.status, "active")))
    .limit(1);
  return m ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOwnerAccount(session.userId);
  if (!m || m.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [loc] = await db.select().from(dk_locations).where(
    and(eq(dk_locations.id, id), eq(dk_locations.account_id, m.accountId))
  ).limit(1);
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const allowed = ["label", "street", "city", "zip", "access_note", "contact_name", "contact_phone"] as const;
  const patch: Partial<typeof dk_locations.$inferInsert> = {};
  for (const key of allowed) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await db.update(dk_locations).set(patch).where(eq(dk_locations.id, id));
  const [updated] = await db.select().from(dk_locations).where(eq(dk_locations.id, id)).limit(1);
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOwnerAccount(session.userId);
  if (!m || m.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [loc] = await db.select().from(dk_locations).where(
    and(eq(dk_locations.id, id), eq(dk_locations.account_id, m.accountId))
  ).limit(1);
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(dk_locations).where(eq(dk_locations.id, id));
  return NextResponse.json({ ok: true });
}
