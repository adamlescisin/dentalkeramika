import { getSessionFromCookies } from "./auth";
import { db } from "../../db";
import { dk_users } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function getAdminSession() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  console.log("[admin-auth] ADMIN_EMAIL:", adminEmail); 
  if (!adminEmail) return null;

  const session = await getSessionFromCookies();
  if (!session) return null;

  const [user] = await db
    .select({ email: dk_users.email })
    .from(dk_users)
    .where(eq(dk_users.id, session.userId))
    .limit(1);

  if (!user || user.email.toLowerCase() !== adminEmail) return null;
  return session;
}
