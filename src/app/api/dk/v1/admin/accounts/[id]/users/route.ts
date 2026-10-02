import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../../db";
import { dk_users, dk_account_users } from "../../../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../../lib/admin-auth";
import { createAuthToken } from "../../../../../../../../lib/auth";
import { sendAdminOnboardingInvite, sendTeamInvite } from "../../../../../../../../lib/email";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const rows = await db
    .select({
      membership_id: dk_account_users.id,
      user_id: dk_users.id,
      email: dk_users.email,
      first_name: dk_users.first_name,
      last_name: dk_users.last_name,
      phone: dk_users.phone,
      role: dk_account_users.role,
      status: dk_account_users.status,
      invited_at: dk_account_users.invited_at,
      accepted_at: dk_account_users.accepted_at,
    })
    .from(dk_account_users)
    .innerJoin(dk_users, eq(dk_account_users.user_id, dk_users.id))
    .where(eq(dk_account_users.account_id, id));

  return NextResponse.json({ data: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: accountId } = await params;

  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const { email, firstName, lastName, phone, role, practiceName } = body;

  if (!email) return NextResponse.json({ error: "E-mail je povinný." }, { status: 400 });
  const validRoles = ["owner", "booker", "viewer"];
  const memberRole = role && validRoles.includes(role) ? role : "booker";

  const normalizedEmail = email.toLowerCase().trim();

  let [user] = await db.select({ id: dk_users.id, email: dk_users.email })
    .from(dk_users)
    .where(eq(dk_users.email, normalizedEmail))
    .limit(1);

  const isNewUser = !user;

  if (!user) {
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Pro nového uživatele zadejte jméno a příjmení." }, { status: 400 });
    }
    [user] = await db.insert(dk_users).values({
      email: normalizedEmail,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone?.trim() || null,
      email_verified_at: new Date(),
    }).returning({ id: dk_users.id, email: dk_users.email });
  }

  // Check not already a member
  const [existing] = await db.select({ id: dk_account_users.id })
    .from(dk_account_users)
    .where(and(eq(dk_account_users.account_id, accountId), eq(dk_account_users.user_id, user.id)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Tento uživatel je již členem ordinace." }, { status: 409 });
  }

  await db.insert(dk_account_users).values({
    account_id: accountId,
    user_id: user.id,
    role: memberRole as "owner" | "booker" | "viewer",
    status: "active",
    accepted_at: new Date(),
  });

  try {
    if (isNewUser) {
      const token = await createAuthToken(user.id, "reset", 72 * 60);
      const setPasswordUrl = `${process.env.NEXT_PUBLIC_APP_URL}/obnova-hesla?token=${token}`;
      await sendAdminOnboardingInvite({ email: normalizedEmail, practiceName: practiceName ?? "vaší ordinaci", setPasswordUrl });
    } else {
      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/dashboard`;
      await sendTeamInvite({
        inviteeEmail: normalizedEmail,
        inviterName: "Admin DentálníKeramika",
        accountName: practiceName ?? "ordinace",
        acceptUrl: portalUrl,
      });
    }
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
