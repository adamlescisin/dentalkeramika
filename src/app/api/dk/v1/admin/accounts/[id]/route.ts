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
  const { status } = await req.json().catch(() => ({}));

  if (!["active", "pending", "suspended"].includes(status)) {
    return NextResponse.json({ error: "Neplatný stav." }, { status: 400 });
  }

  const patch: Partial<typeof dk_accounts.$inferInsert> = { status };
  if (status === "active") {
    patch.approved_at = new Date();
    patch.approved_by = session.userId;
  }

  const [updated] = await db.update(dk_accounts).set(patch).where(eq(dk_accounts.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}
