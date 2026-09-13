import { redirect } from "next/navigation";
import { getAdminSession } from "../../../lib/admin-auth";
import WorkingHoursEditor from "./WorkingHoursEditor";

export const dynamic = "force-dynamic";

export default async function AdminPracovniDobaPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/prihlasit");
  return <WorkingHoursEditor />;
}
