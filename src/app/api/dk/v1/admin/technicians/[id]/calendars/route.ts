import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "../../../../../../../../lib/admin-auth";
import { listTechnicianCalendars } from "../../../../../../../../lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const calendars = await listTechnicianCalendars(id);
    return NextResponse.json({ data: calendars });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
