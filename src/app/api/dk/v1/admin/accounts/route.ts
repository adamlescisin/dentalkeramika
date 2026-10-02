import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_accounts, dk_users, dk_account_users } from "../../../../../../../db/schema";
import { asc, eq } from "drizzle-orm";
import { getAdminSession } from "../../../../../../lib/admin-auth";
import { createAuthToken } from "../../../../../../lib/auth";
import { sendAdminOnboardingInvite } from "../../../../../../lib/email";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(dk_accounts).orderBy(asc(dk_accounts.created_at));
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const { firstName, lastName, email, phone, practiceName, ico, dic, billingEmail, billingAddress } = body;

  if (!firstName || !lastName || !email || !practiceName) {
    return NextResponse.json({ error: "Vyplňte jméno, příjmení, e-mail a název ordinace." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find or create user (admin-created accounts skip email verification)
  let [user] = await db.select({ id: dk_users.id, email: dk_users.email })
    .from(dk_users)
    .where(eq(dk_users.email, normalizedEmail))
    .limit(1);

  if (!user) {
    [user] = await db.insert(dk_users).values({
      email: normalizedEmail,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone?.trim() || null,
      email_verified_at: new Date(),
    }).returning({ id: dk_users.id, email: dk_users.email });
  }

  // Create account (immediately active — admin is vouching)
  const [account] = await db.insert(dk_accounts).values({
    name: practiceName.trim(),
    ico: ico?.trim() || null,
    dic: dic?.trim() || null,
    billing_email: billingEmail?.trim() || normalizedEmail,
    billing_address: billingAddress?.trim() || null,
    status: "active",
    approved_at: new Date(),
    approved_by: session.userId,
  }).returning();

  // Link user as owner
  await db.insert(dk_account_users).values({
    account_id: account.id,
    user_id: user.id,
    role: "owner",
    status: "active",
    accepted_at: new Date(),
  });

  // Send set-password invite (reset token, 72 h)
  try {
    const token = await createAuthToken(user.id, "reset", 72 * 60);
    const setPasswordUrl = `${process.env.NEXT_PUBLIC_APP_URL}/obnova-hesla?token=${token}`;
    await sendAdminOnboardingInvite({ email: normalizedEmail, practiceName: practiceName.trim(), setPasswordUrl });
  } catch {
    // Non-fatal — account is created even if email fails
  }

  return NextResponse.json({ data: account }, { status: 201 });
}
