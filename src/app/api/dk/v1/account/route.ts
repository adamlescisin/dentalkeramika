import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../db";
import { dk_accounts, dk_account_users } from "../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

async function getMembership(userId: string) {
  const [m] = await db
    .select({ account: dk_accounts, role: dk_account_users.role })
    .from(dk_account_users)
    .innerJoin(dk_accounts, eq(dk_accounts.id, dk_account_users.account_id))
    .where(
      and(
        eq(dk_account_users.user_id, userId),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);
  return m ?? null;
}

export async function GET(_req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getMembership(session.userId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: m.account, role: m.role });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getMembership(session.userId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const allowed = ["name", "ico", "dic", "billing_email", "billing_address"] as const;
  const patch: Partial<typeof dk_accounts.$inferInsert> = {};
  for (const key of allowed) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(dk_accounts).set(patch).where(eq(dk_accounts.id, m.account.id));

  const [updated] = await db.select().from(dk_accounts).where(eq(dk_accounts.id, m.account.id)).limit(1);
  return NextResponse.json({ data: updated });
}
