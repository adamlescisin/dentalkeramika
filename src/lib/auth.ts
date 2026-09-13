import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../../db";
import { dk_users, dk_sessions, dk_auth_tokens, dk_rate_limits } from "../../db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";

const SESSION_COOKIE = "dk_session";
const SESSION_DAYS = 30;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-in-production");

// ─── Hashing ─────────────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Session management ───────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  deviceHint?: string
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(dk_sessions).values({
    user_id: userId,
    token_hash: tokenHash,
    device_hint: deviceHint,
    expires_at: expiresAt,
  });

  // Sign a short-lived JWT that carries the session token
  const jwt = await new SignJWT({ sub: userId, sid: token })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(JWT_SECRET);

  return jwt;
}

export async function verifySession(
  jwt: string
): Promise<{ userId: string; sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(jwt, JWT_SECRET);
    const { sub: userId, sid: sessionToken } = payload as { sub: string; sid: string };

    const tokenHash = hashToken(sessionToken);
    const [session] = await db
      .select()
      .from(dk_sessions)
      .where(
        and(
          eq(dk_sessions.token_hash, tokenHash),
          gt(dk_sessions.expires_at, new Date())
        )
      )
      .limit(1);

    if (!session) return null;

    // Touch last_seen
    await db
      .update(dk_sessions)
      .set({ last_seen_at: new Date() })
      .where(eq(dk_sessions.id, session.id));

    return { userId, sessionId: session.id };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  return verifySession(jwt);
}

export async function invalidateSession(sessionId: string) {
  await db.delete(dk_sessions).where(eq(dk_sessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: string) {
  await db.delete(dk_sessions).where(eq(dk_sessions.user_id, userId));
}

// ─── Auth tokens (magic links, resets, verification) ─────────────────────────

export async function createAuthToken(
  userId: string,
  type: "magic_link" | "reset" | "verify_email" | "email_change",
  expiryMinutes: number,
  email?: string
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await db.insert(dk_auth_tokens).values({
    user_id: userId,
    token_hash: tokenHash,
    type,
    email,
    expires_at: expiresAt,
  });

  return token;
}

export async function consumeAuthToken(
  token: string,
  type: string
): Promise<{ userId: string; email?: string | null } | null> {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(dk_auth_tokens)
    .where(
      and(
        eq(dk_auth_tokens.token_hash, tokenHash),
        eq(dk_auth_tokens.type, type),
        gt(dk_auth_tokens.expires_at, new Date()),
      )
    )
    .limit(1);

  if (!row || row.used_at) return null;

  await db
    .update(dk_auth_tokens)
    .set({ used_at: new Date() })
    .where(eq(dk_auth_tokens.id, row.id));

  return { userId: row.user_id, email: row.email };
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

const EMAIL_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const IP_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };

export async function checkRateLimit(
  key: string,
  limit: { max: number; windowMs: number }
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - limit.windowMs);

  const [row] = await db
    .select()
    .from(dk_rate_limits)
    .where(eq(dk_rate_limits.key, key))
    .limit(1);

  if (!row || row.window_start < windowStart) {
    // Reset window
    await db
      .insert(dk_rate_limits)
      .values({ key, attempts: 1, window_start: new Date() })
      .onConflictDoUpdate({
        target: dk_rate_limits.key,
        set: { attempts: 1, window_start: new Date() },
      });
    return { allowed: true, remaining: limit.max - 1 };
  }

  if (row.attempts >= limit.max) {
    return { allowed: false, remaining: 0 };
  }

  await db
    .update(dk_rate_limits)
    .set({ attempts: row.attempts + 1 })
    .where(eq(dk_rate_limits.key, key));

  return { allowed: true, remaining: limit.max - row.attempts - 1 };
}

export async function checkLoginRateLimit(email: string, ip: string) {
  const [byEmail, byIp] = await Promise.all([
    checkRateLimit(`email:${email.toLowerCase()}`, EMAIL_LIMIT),
    checkRateLimit(`ip:${ip}`, IP_LIMIT),
  ]);
  return byEmail.allowed && byIp.allowed;
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export function buildSessionCookie(jwt: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ─── HIBP password check ──────────────────────────────────────────────────────

export async function isPasswordPwned(password: string): Promise<boolean> {
  const { createHash } = await import("crypto");
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false; // fail open — don't block registration if HIBP is down
    const text = await res.text();
    return text.split("\n").some((line) => line.startsWith(suffix));
  } catch {
    return false;
  }
}
