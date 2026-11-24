import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_users } from "../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromCookies } from "../../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Nejste přihlášeni. Přihlaste se prosím znovu." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { phone?: unknown };
  if (body.phone === undefined) return NextResponse.json({ error: "Nebyly zadány žádné změny." }, { status: 400 });

  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 32) : "";
  await db
    .update(dk_users)
    .set({ phone: phone || null, updated_at: new Date() })
    .where(eq(dk_users.id, session.userId));

  return NextResponse.json({ data: { phone: phone || null } });
}
