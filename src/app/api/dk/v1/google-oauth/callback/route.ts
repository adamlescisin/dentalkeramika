import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client, saveTokensForTechnician } from "../../../../../../lib/google-calendar";
import { db } from "../../../../../../../db";
import { dk_technicians } from "../../../../../../../db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const technicianId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/kalendar?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !technicianId) {
    return NextResponse.redirect(new URL("/admin/kalendar?error=missing_params", req.url));
  }

  const [technician] = await db
    .select()
    .from(dk_technicians)
    .where(eq(dk_technicians.id, technicianId))
    .limit(1);

  if (!technician) {
    return NextResponse.redirect(new URL("/admin/kalendar?error=technician_not_found", req.url));
  }

  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.redirect(new URL("/admin/kalendar?error=no_tokens", req.url));
  }

  await saveTokensForTechnician(
    technicianId,
    tokens.access_token,
    tokens.refresh_token,
    tokens.expiry_date
  );

  // Always send to the calendar picker — even for reconnects — so the admin
  // can confirm (or change) which calendar is used.
  return NextResponse.redirect(
    new URL(`/admin/kalendar?pick=${encodeURIComponent(technicianId)}`, req.url)
  );
}
