import { redirect } from "next/navigation";
import { getSessionFromCookies } from "../../../../../lib/auth";
import { db } from "../../../../../../db";
import { dk_account_users } from "../../../../../../db/schema";
import { eq, and } from "drizzle-orm";
import WorkingHoursEditor from "./WorkingHoursEditor";

export const dynamic = "force-dynamic";

export default async function PracovniDobaPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/prihlasit");

  const [membership] = await db
    .select()
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.role, "owner"),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership) redirect("/portal/dashboard");

  return <WorkingHoursEditor />;
}
