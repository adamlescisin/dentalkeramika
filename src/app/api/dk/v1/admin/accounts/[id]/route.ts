import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import { dk_accounts } from "../../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const { status, name, ico, dic, billing_email, billing_address } = body;

  const patch: Partial<typeof dk_accounts.$inferInsert> = {};

  if (status !== undefined) {
    if (!["active", "pending", "suspended"].includes(status)) {
      return NextResponse.json({ error: "Neplatný stav." }, { status: 400 });
    }
    patch.status = status as typeof patch.status;
    if (status === "active") {
      patch.approved_at = new Date();
      patch.approved_by = session.userId;
    }
  }

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "Název nesmí být prázdný." }, { status: 400 });
    patch.name = name.trim();
  }
  if (ico !== undefined) patch.ico = ico.trim() || null;
  if (dic !== undefined) patch.dic = dic.trim() || null;
  if (billing_email !== undefined) patch.billing_email = billing_email.trim() || null;
  if (billing_address !== undefined) patch.billing_address = billing_address.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nic ke změně." }, { status: 400 });
  }

  const [updated] = await db.update(dk_accounts).set(patch).where(eq(dk_accounts.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}
