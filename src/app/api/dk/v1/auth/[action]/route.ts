import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import {
  dk_users,
  dk_accounts,
  dk_account_users,
  dk_locations,
  dk_sessions,
} from "../../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  buildSessionCookie,
  clearSessionCookie,
  createAuthToken,
  consumeAuthToken,
  invalidateAllUserSessions,
  checkLoginRateLimit,
  isPasswordPwned,
  getSessionFromCookies,
} from "../../../../../../lib/auth";
import {
  sendVerificationEmail,
  sendMagicLink,
  sendPasswordReset,
} from "../../../../../../lib/email";

export const dynamic = "force-dynamic";

// GET /api/dk/v1/auth/verify?token=…&type=verify_email
// Handles email verification links — redirects to login on success.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  if (action !== "verify") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");
  const type = searchParams.get("type");

  if (!token || (type !== "verify_email" && type !== "magic")) {
    return NextResponse.redirect(
      new URL("/prihlasit?error=invalid_link", req.url)
    );
  }

  if (type === "magic") {
    const result = await consumeAuthToken(token, "magic_link");
    if (!result) {
      return NextResponse.redirect(
        new URL("/prihlasit?error=link_expired", req.url)
      );
    }
    // Activate any pending team invites for this user
    await db
      .update(dk_account_users)
      .set({ status: "active", accepted_at: new Date() })
      .where(
        and(
          eq(dk_account_users.user_id, result.userId),
          eq(dk_account_users.status, "invited")
        )
      );
    const next = searchParams.get("next") ?? "/portal/dashboard";
    const jwt = await createSession(result.userId);
    const redirectRes = NextResponse.redirect(new URL(next, req.url));
    redirectRes.headers.set("Set-Cookie", buildSessionCookie(jwt));
    return redirectRes;
  }

  const result = await consumeAuthToken(token, "verify_email");
  if (!result) {
    return NextResponse.redirect(
      new URL("/prihlasit?error=link_expired", req.url)
    );
  }

  await db
    .update(dk_users)
    .set({ email_verified_at: new Date(), updated_at: new Date() })
    .where(eq(dk_users.id, result.userId));

  return NextResponse.redirect(
    new URL("/prihlasit?verified=1", req.url)
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;

  switch (action) {
    case "login":
      return handleLogin(req);
    case "magic-link":
      return handleMagicLink(req);
    case "reset":
      return handleReset(req);
    case "verify":
      return handleVerify(req);
    case "register":
      return handleRegister(req);
    case "logout":
      return handleLogout(req);
    default:
      return NextResponse.json({ error: "Unknown auth action" }, { status: 404 });
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function handleLogin(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const allowed = await checkLoginRateLimit(email, ip);
  const genericError = "Nesprávný e-mail nebo heslo.";

  if (!allowed) {
    return NextResponse.json({ error: genericError }, { status: 429 });
  }

  const [user] = await db
    .select()
    .from(dk_users)
    .where(eq(dk_users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.password_hash) {
    return NextResponse.json({ error: genericError }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: genericError }, { status: 401 });
  }

  if (!user.email_verified_at) {
    return NextResponse.json(
      { error: "Před přihlášením je nutné ověřit e-mail." },
      { status: 403 }
    );
  }

  const deviceHint =
    req.headers.get("user-agent")?.slice(0, 200) ?? undefined;
  const jwt = await createSession(user.id, deviceHint);

  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildSessionCookie(jwt));
  return res;
}

// ─── Magic link request ───────────────────────────────────────────────────────

async function handleMagicLink(req: NextRequest) {
  const { email } = await req.json();

  const [user] = await db
    .select()
    .from(dk_users)
    .where(eq(dk_users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = await createAuthToken(user.id, "magic_link", 15);
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/dk/v1/auth/verify?token=${token}&type=magic`;

  await sendMagicLink(user.email, url);
  return NextResponse.json({ ok: true });
}

// ─── Magic link / reset token verification ────────────────────────────────────

async function handleVerify(req: NextRequest) {
  const { token, type, newPassword } = await req.json();

  if (type === "magic") {
    const result = await consumeAuthToken(token, "magic_link");
    if (!result) {
      return NextResponse.json(
        { error: "Odkaz je neplatný nebo vypršel." },
        { status: 400 }
      );
    }

    const jwt = await createSession(result.userId);
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", buildSessionCookie(jwt));
    return res;
  }

  if (type === "reset") {
    if (!newPassword || newPassword.length < 10) {
      return NextResponse.json(
        { error: "Heslo musí mít alespoň 10 znaků." },
        { status: 400 }
      );
    }

    const pwned = await isPasswordPwned(newPassword);
    if (pwned) {
      return NextResponse.json(
        { error: "Toto heslo bylo kompromitováno — zvolte prosím jiné." },
        { status: 400 }
      );
    }

    const result = await consumeAuthToken(token, "reset");
    if (!result) {
      return NextResponse.json(
        { error: "Odkaz je neplatný nebo vypršel." },
        { status: 400 }
      );
    }

    const hash = await hashPassword(newPassword);
    await db
      .update(dk_users)
      .set({ password_hash: hash, updated_at: new Date() })
      .where(eq(dk_users.id, result.userId));

    await invalidateAllUserSessions(result.userId);

    return NextResponse.json({ ok: true });
  }

  if (type === "verify_email") {
    const result = await consumeAuthToken(token, "verify_email");
    if (!result) {
      return NextResponse.json(
        { error: "Odkaz je neplatný nebo vypršel." },
        { status: 400 }
      );
    }

    await db
      .update(dk_users)
      .set({ email_verified_at: new Date(), updated_at: new Date() })
      .where(eq(dk_users.id, result.userId));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown verification type" }, { status: 400 });
}

// ─── Password reset request ───────────────────────────────────────────────────

async function handleReset(req: NextRequest) {
  const { email } = await req.json();

  const [user] = await db
    .select()
    .from(dk_users)
    .where(eq(dk_users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = await createAuthToken(user.id, "reset", 60);
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/obnova-hesla?token=${token}`;

  await sendPasswordReset(user.email, url);
  return NextResponse.json({ ok: true });
}

// ─── Registration ─────────────────────────────────────────────────────────────

async function handleRegister(req: NextRequest) {
  const body = await req.json();
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    practiceName,
    ico,
    billingEmail,
    locationStreet,
    locationCity,
    locationZip,
    locationLabel,
    locationAccessNote,
  } = body;

  if (!firstName || !lastName || !email || !password || !practiceName) {
    return NextResponse.json(
      { error: "Vyplňte všechna povinná pole." },
      { status: 400 }
    );
  }

  if (password.length < 10) {
    return NextResponse.json(
      { error: "Heslo musí mít alespoň 10 znaků." },
      { status: 400 }
    );
  }

  const pwned = await isPasswordPwned(password);
  if (pwned) {
    return NextResponse.json(
      { error: "Toto heslo bylo kompromitováno — zvolte prosím jiné." },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select({ id: dk_users.id })
    .from(dk_users)
    .where(eq(dk_users.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const hash = await hashPassword(password);

  const [user] = await db
    .insert(dk_users)
    .values({
      email: email.toLowerCase().trim(),
      password_hash: hash,
      first_name: firstName,
      last_name: lastName,
      phone: phone ?? null,
    })
    .returning({ id: dk_users.id, email: dk_users.email });

  const autoApprove = process.env.AUTO_APPROVE_ACCOUNTS !== "false";

  const [account] = await db
    .insert(dk_accounts)
    .values({
      name: practiceName,
      ico: ico ?? null,
      billing_email: billingEmail ?? email.toLowerCase().trim(),
      status: autoApprove ? "active" : "pending",
      approved_at: autoApprove ? new Date() : null,
    })
    .returning({ id: dk_accounts.id });

  await db.insert(dk_account_users).values({
    account_id: account.id,
    user_id: user.id,
    role: "owner",
    status: "active",
    accepted_at: new Date(),
  });

  if (locationStreet && locationCity && locationZip) {
    await db.insert(dk_locations).values({
      account_id: account.id,
      label: locationLabel ?? practiceName,
      street: locationStreet,
      city: locationCity,
      zip: locationZip,
      access_note: locationAccessNote ?? null,
      is_default: true,
    });
  }

  const verifyToken = await createAuthToken(user.id, "verify_email", 60);
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/dk/v1/auth/verify?token=${verifyToken}&type=verify_email`;

  try {
    await sendVerificationEmail(user.email, verifyUrl);
  } catch (err) {
    // Account created successfully — email is best-effort; log for debugging.
    console.error("[register] Verification email failed for", user.email, err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function handleLogout(_req: NextRequest) {
  const session = await getSessionFromCookies();
  if (session) {
    await db.delete(dk_sessions).where(eq(dk_sessions.id, session.sessionId));
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
