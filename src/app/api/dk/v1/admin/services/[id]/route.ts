import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import { dk_services } from "../../../../../../../../db/schema";
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
  const body = await req.json().catch(() => ({}));
  const allowed = ["name", "slug", "duration_min", "buffer_before_min", "buffer_after_min",
                   "bookable_online", "requires_approval", "active"] as const;
  const patch: Partial<typeof dk_services.$inferInsert> = {};
  for (const key of allowed) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  patch.updated_by = session.userId;
  patch.updated_at = new Date();

  const [updated] = await db.update(dk_services).set(patch).where(eq(dk_services.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}
