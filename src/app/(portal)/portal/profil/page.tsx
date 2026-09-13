import { redirect } from "next/navigation";
import { getSessionFromCookies } from "../../../../lib/auth";
import { db } from "../../../../../db";
import { dk_accounts, dk_account_users, dk_users, dk_locations } from "../../../../../db/schema";
import { eq, and, asc } from "drizzle-orm";
import ProfilClient from "./ProfilClient";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/prihlasit");

  const [membership] = await db
    .select({ account: dk_accounts, role: dk_account_users.role })
    .from(dk_account_users)
    .innerJoin(dk_accounts, eq(dk_accounts.id, dk_account_users.account_id))
    .where(and(eq(dk_account_users.user_id, session.userId), eq(dk_account_users.status, "active")))
    .limit(1);

  if (!membership) redirect("/portal/dashboard");

  const locations = await db
    .select()
    .from(dk_locations)
    .where(eq(dk_locations.account_id, membership.account.id))
    .orderBy(asc(dk_locations.created_at));

  const teamMembersRaw = await db
    .select({
      id: dk_account_users.id,
      role: dk_account_users.role,
      status: dk_account_users.status,
      invited_at: dk_account_users.invited_at,
      email: dk_users.email,
      first_name: dk_users.first_name,
      last_name: dk_users.last_name,
    })
    .from(dk_account_users)
    .innerJoin(dk_users, eq(dk_users.id, dk_account_users.user_id))
    .where(eq(dk_account_users.account_id, membership.account.id))
    .orderBy(asc(dk_account_users.invited_at));

  const teamMembers = teamMembersRaw.map((m) => ({
    ...m,
    invited_at: m.invited_at ? m.invited_at.toISOString() : null,
  }));

  return (
    <ProfilClient
      account={membership.account}
      role={membership.role}
      locations={locations}
      team={teamMembers}
    />
  );
}
