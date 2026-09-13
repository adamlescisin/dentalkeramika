import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_accounts, dk_account_users, dk_locations } from "../../../../../../../db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../lib/auth";

export const dynamic = "force-dynamic";

async function getOwnerAccount(userId: string) {
  const [m] = await db
    .select({ accountId: dk_account_users.account_id, role: dk_account_users.role })
    .from(dk_account_users)
    .where(and(eq(dk_account_users.user_id, userId), eq(dk_account_users.status, "active")))
    .limit(1);
  return m ?? null;
}

export async function GET(_req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOwnerAccount(session.userId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const locations = await db
    .select()
    .from(dk_locations)
    .where(eq(dk_locations.account_id, m.accountId))
    .orderBy(asc(dk_locations.created_at));

  return NextResponse.json({ data: locations });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOwnerAccount(session.userId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { label, street, city, zip, access_note, contact_name, contact_phone } = body;

  if (!label || !street || !city || !zip) {
    return NextResponse.json({ error: "label, street, city, zip jsou povinné." }, { status: 400 });
  }

  const [loc] = await db
    .insert(dk_locations)
    .values({
      account_id: m.accountId,
      label,
      street,
      city,
      zip,
      access_note: access_note ?? null,
      contact_name: contact_name ?? null,
      contact_phone: contact_phone ?? null,
    })
    .returning();

  return NextResponse.json({ data: loc }, { status: 201 });
}
