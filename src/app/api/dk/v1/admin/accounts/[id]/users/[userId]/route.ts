import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../../../db";
import { dk_users, dk_account_users } from "../../../../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: accountId, userId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, string>;

  const [membership] = await db.select()
    .from(dk_account_users)
    .where(and(eq(dk_account_users.account_id, accountId), eq(dk_account_users.user_id, userId)))
    .limit(1);

  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Update role
  if (body.role !== undefined) {
    const validRoles = ["owner", "booker", "viewer"];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: "Neplatná role." }, { status: 400 });
    }
    await db.update(dk_account_users)
      .set({ role: body.role as "owner" | "booker" | "viewer" })
      .where(eq(dk_account_users.id, membership.id));
  }

  // Update email on the user record
  if (body.email !== undefined) {
    const newEmail = body.email.toLowerCase().trim();
    if (!newEmail) return NextResponse.json({ error: "E-mail nesmí být prázdný." }, { status: 400 });

    // Check uniqueness
    const [conflict] = await db.select({ id: dk_users.id })
      .from(dk_users)
      .where(eq(dk_users.email, newEmail))
      .limit(1);
    if (conflict && conflict.id !== userId) {
      return NextResponse.json({ error: "Tento e-mail již používá jiný uživatel." }, { status: 409 });
    }

    await db.update(dk_users)
      .set({ email: newEmail, updated_at: new Date() })
      .where(eq(dk_users.id, userId));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: accountId, userId } = await params;

  const [membership] = await db.select()
    .from(dk_account_users)
    .where(and(eq(dk_account_users.account_id, accountId), eq(dk_account_users.user_id, userId)))
    .limit(1);

  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Count owners — cannot remove the last owner
  if (membership.role === "owner") {
    const owners = await db.select({ id: dk_account_users.id })
      .from(dk_account_users)
      .where(and(
        eq(dk_account_users.account_id, accountId),
        eq(dk_account_users.role, "owner"),
        eq(dk_account_users.status, "active"),
      ));
    if (owners.length <= 1) {
      return NextResponse.json({ error: "Nelze odebrat posledního vlastníka účtu." }, { status: 400 });
    }
  }

  await db.delete(dk_account_users).where(eq(dk_account_users.id, membership.id));
  return NextResponse.json({ ok: true });
}
