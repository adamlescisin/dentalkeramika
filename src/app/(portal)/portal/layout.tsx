import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "../../../lib/auth";
import { db } from "../../../../db";
import { dk_account_users, dk_reservations, dk_booking_rules } from "../../../../db/schema";
import { eq, and, gt, notInArray, or } from "drizzle-orm";
import { PortalNav } from "./_components/PortalNav";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/prihlasit");

  const memberships = await db
    .select({ account_id: dk_account_users.account_id })
    .from(dk_account_users)
    .where(and(eq(dk_account_users.user_id, session.userId), eq(dk_account_users.status, "active")));

  let upcomingCount = 0;
  if (memberships.length > 0) {
    const rows = await db
      .select({ id: dk_reservations.id })
      .from(dk_reservations)
      .where(
        and(
          or(...memberships.map((m) => eq(dk_reservations.account_id, m.account_id))),
          gt(dk_reservations.starts_at, new Date()),
          notInArray(dk_reservations.status, ["cancelled", "completed", "no_show", "rejected"])
        )
      );
    upcomingCount = rows.length;
  }

  const [rules] = await db
    .select({ contact_phone: dk_booking_rules.contact_phone, support_email: dk_booking_rules.support_email })
    .from(dk_booking_rules)
    .where(eq(dk_booking_rules.id, 1))
    .limit(1);

  return (
    <>
      <style>{`
        .portal-wrap { display: flex; min-height: 100vh; background: var(--porcelain); }

        .portal-sidebar {
          width: 240px;
          min-width: 240px;
          background: #fff;
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }
        .sidebar-logo {
          padding: 24px 20px 20px;
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.02em;
          text-decoration: none;
          border-bottom: 1px solid var(--line);
          display: block;
        }
        .sidebar-section { padding: 12px 0; }
        .sidebar-sep { height: 1px; background: var(--line); margin: 8px 20px; }
        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 20px;
          font-size: 13.5px;
          color: #6b7f8a;
          text-decoration: none;
          border-left: 3px solid transparent;
          transition: background 0.1s, color 0.1s;
          font-weight: 400;
        }
        .nav-item:hover { background: var(--porcelain); color: var(--ink); }
        .nav-item.active {
          border-left-color: var(--cyan);
          background: var(--porcelain);
          color: var(--ink);
          font-weight: 600;
        }
        .nav-badge {
          background: var(--cyan);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 999px;
          min-width: 20px;
          text-align: center;
        }
        .sidebar-contact {
          margin-top: auto;
          padding: 14px 20px;
          border-top: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sidebar-contact-item { display: flex; flex-direction: column; gap: 1px; }
        .sidebar-contact-label { font-size: 10.5px; font-weight: 600; color: #9aacb8; text-transform: uppercase; letter-spacing: 0.05em; }
        .sidebar-contact-value { font-size: 12.5px; color: var(--cyan-deep); text-decoration: none; }
        .sidebar-contact-value:hover { text-decoration: underline; }

        .sidebar-bottom {
          padding: 14px 20px;
          border-top: 1px solid var(--line);
        }
        .sidebar-bottom form button {
          font-size: 13px;
          color: var(--status-cancelled);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .portal-content { flex: 1; min-width: 0; overflow-y: auto; }

        @media (max-width: 767px) {
          .portal-wrap { flex-direction: column; }
          .portal-sidebar {
            width: 100%;
            min-width: 0;
            height: auto;
            position: static;
            border-right: none;
            border-bottom: 1px solid var(--line);
            flex-direction: row;
            align-items: center;
            overflow-x: auto;
            overflow-y: visible;
          }
          .sidebar-logo {
            border-bottom: none;
            padding: 14px 16px;
            white-space: nowrap;
            border-right: 1px solid var(--line);
          }
          .sidebar-section { display: flex; flex-direction: row; padding: 0; flex-shrink: 0; }
          .sidebar-sep { display: none; }
          .nav-item {
            padding: 14px 14px;
            border-left: none;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
          }
          .nav-item.active { border-left-color: transparent; border-bottom-color: var(--cyan); }
          .sidebar-contact { display: none; }
          .sidebar-bottom { display: none; }
        }
      `}</style>

      <div className="portal-wrap">
        <aside className="portal-sidebar">
          <Link href="/portal/dashboard" className="sidebar-logo">
            <Image src="/logo.webp" alt="DentálníKeramika" height={28} width={140} style={{ objectFit: "contain", display: "block" }} />
          </Link>
          <PortalNav
            upcomingCount={upcomingCount}
            contactPhone={rules?.contact_phone}
            supportEmail={rules?.support_email}
          />
        </aside>
        <div className="portal-content">
          {children}
        </div>
      </div>
    </>
  );
}
