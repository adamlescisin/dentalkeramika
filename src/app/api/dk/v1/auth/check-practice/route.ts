import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_accounts } from "../../../../../../../db/schema";
import { eq, ilike, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Public endpoint — no auth required (called during registration flow)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ico = searchParams.get("ico")?.trim();
  const name = searchParams.get("name")?.trim();

  if (!ico && !name) {
    return NextResponse.json({ exists: false });
  }

  const conditions = [];
  if (ico && ico.length >= 7) conditions.push(eq(dk_accounts.ico, ico));
  if (name && name.length >= 3) conditions.push(ilike(dk_accounts.name, name));

  if (conditions.length === 0) return NextResponse.json({ exists: false });

  const [account] = await db
    .select({ id: dk_accounts.id, name: dk_accounts.name, ico: dk_accounts.ico })
    .from(dk_accounts)
    .where(or(...conditions))
    .limit(1);

  if (!account) return NextResponse.json({ exists: false });

  return NextResponse.json({ exists: true, id: account.id, name: account.name, ico: account.ico });
}
