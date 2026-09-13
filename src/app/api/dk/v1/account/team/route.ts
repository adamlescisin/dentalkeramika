import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_account_users, dk_users, dk_accounts } from "../../../../../../../db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../lib/auth";
import { createAuthToken } from "../../../../../../lib/auth";
import { sendTeamInvite } from "../../../../../../lib/email";

export const dynamic = "force-dynamic";

async function getOwnerMembership(userId: string) {
  const [m] = await db
    .select({
      accountId: dk_account_users.account_id,
      role: dk_account_users.role,
      accountName: dk_accounts.name,
    })
    .from(dk_account_users)
    .innerJoin(dk_accounts, eq(dk_accounts.id, dk_account_users.account_id))
    .where(and(eq(dk_account_users.user_id, userId), eq(dk_account_users.status, "active")))
    .limit(1);
  return m ?? null;
}

export async function GET(_req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOwnerMembership(session.userId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await db
    .select({
      id: dk_account_users.id,
      role: dk_account_users.role,
      status: dk_account_users.status,
      invited_at: dk_account_users.invited_at,
      accepted_at: dk_account_users.accepted_at,
      email: dk_users.email,
      first_name: dk_users.first_name,
      last_name: dk_users.last_name,
    })
    .from(dk_account_users)
    .innerJoin(dk_users, eq(dk_users.id, dk_account_users.user_id))
    .where(eq(dk_account_users.account_id, m.accountId))
    .orderBy(asc(dk_account_users.invited_at));

  return NextResponse.json({ data: members });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOwnerMembership(session.userId);
  if (!m || m.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, role = "booker", firstName, lastName } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: "E-mail je povinný." }, { status: 400 });
  if (!["booker", "viewer"].includes(role)) return NextResponse.json({ error: "Neplatná role." }, { status: 400 });

  const normalizedEmail = email.toLowerCase().trim();

  // Find or create user
  let [user] = await db
    .select()
    .from(dk_users)
    .where(eq(dk_users.email, normalizedEmail))
    .limit(1);

  if (!user) {
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Pro nového uživatele je třeba uvést jméno a příjmení." }, { status: 400 });
    }
    [user] = await db
      .insert(dk_users)
      .values({ email: normalizedEmail, first_name: firstName, last_name: lastName })
      .returning();
  }

  // Check existing membership
  const [existing] = await db
    .select()
    .from(dk_account_users)
    .where(and(eq(dk_account_users.account_id, m.accountId), eq(dk_account_users.user_id, user.id)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Tento uživatel je již členem týmu." }, { status: 409 });
  }

  await db.insert(dk_account_users).values({
    account_id: m.accountId,
    user_id: user.id,
    role,
    invited_by: session.userId,
    invited_at: new Date(),
    status: "invited",
  });

  // Send invite email (best-effort)
  try {
    const [caller] = await db.select().from(dk_users).where(eq(dk_users.id, session.userId)).limit(1);
    const token = await createAuthToken(user.id, "magic_link", 7 * 24 * 60);
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/dk/v1/auth/verify?token=${token}&type=magic&next=/portal/dashboard`;
    await sendTeamInvite({
      inviteeEmail: normalizedEmail,
      inviterName: caller ? `${caller.first_name} ${caller.last_name}` : "Váš kolega",
      accountName: m.accountName ?? "ordinace",
      acceptUrl,
    });
  } catch (err) {
    console.error("[team/invite] email failed:", err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
