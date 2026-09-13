import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "../../../../../../lib/admin-auth";
import { db } from "../../../../../../../db";
import { dk_oauth_tokens, dk_technicians } from "../../../../../../../db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.redirect(new URL("/admin/prihlasit", req.url));

  const technicianId = req.nextUrl.searchParams.get("technician_id");
  if (!technicianId) {
    return NextResponse.json({ error: "technician_id required" }, { status: 400 });
  }

  await db.delete(dk_oauth_tokens).where(eq(dk_oauth_tokens.technician_id, technicianId));
  await db.update(dk_technicians).set({ google_calendar_id: null }).where(eq(dk_technicians.id, technicianId));

  return NextResponse.redirect(new URL("/admin/kalendar?disconnected=1", req.url));
}
