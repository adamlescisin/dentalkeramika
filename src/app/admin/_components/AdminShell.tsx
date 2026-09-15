"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ReactNode } from "react";

const NAV: ({ href: string; label: string; exact?: boolean } | null)[] = [
  { href: "/admin",              label: "Přehled",              exact: true },
  { href: "/admin/technici",     label: "Technici" },
  { href: "/admin/kalendar",     label: "Google Kalendář" },
  { href: "/admin/pracovni-doba",label: "Pracovní doba" },
  { href: "/admin/sluzby",       label: "Služby" },
  { href: "/admin/ordinace",     label: "Ordinace" },
  { href: "/admin/rezervace",    label: "Čekající rezervace" },
  null,
  { href: "/admin/nastaveni",    label: "Nastavení" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <style>{`
        .admin-shell {
          display: flex;
          min-height: 100vh;
          background: var(--porcelain);
        }
        .admin-sidebar {
          width: 220px;
          flex-shrink: 0;
          background: #fff;
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }
        .admin-sidebar-logo {
          padding: 20px 20px 12px;
          border-bottom: 1px solid var(--line);
        }
        .admin-sidebar-logo a {
          font-weight: 700;
          font-size: 15px;
          color: var(--ink);
          text-decoration: none;
          font-variation-settings: 'wdth' 112;
          letter-spacing: -0.01em;
        }
        .admin-sidebar-logo span {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9aacb8;
          margin-top: 2px;
        }
        .admin-nav {
          flex: 1;
          padding: 8px 0;
          display: flex;
          flex-direction: column;
        }
        .admin-nav-item {
          display: block;
          padding: 8px 20px;
          font-size: 13px;
          font-weight: 500;
          color: #6b7f8a;
          text-decoration: none;
          border-left: 3px solid transparent;
          transition: color 0.12s, background 0.12s;
        }
        .admin-nav-item:hover {
          color: var(--ink);
          background: var(--porcelain);
        }
        .admin-nav-item.active {
          color: var(--cyan-deep);
          border-left-color: var(--cyan);
          background: color-mix(in srgb, var(--cyan) 8%, transparent);
          font-weight: 600;
        }
        .admin-nav-sep {
          border: none;
          border-top: 1px solid var(--line);
          margin: 6px 0;
        }
        .admin-sidebar-footer {
          padding: 12px 20px 20px;
          border-top: 1px solid var(--line);
        }
        .admin-logout {
          font-size: 12px;
          color: var(--status-cancelled);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
        }
        .admin-logout:hover { opacity: 0.75; }
        .admin-content {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
        }

        @media (max-width: 640px) {
          .admin-shell { flex-direction: column; }
          .admin-sidebar {
            width: 100%;
            height: auto;
            position: static;
            border-right: none;
            border-bottom: 1px solid var(--line);
          }
          .admin-sidebar-logo { padding: 14px 16px 10px; }
          .admin-nav {
            flex-direction: row;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding: 4px 8px;
            scrollbar-width: none;
          }
          .admin-nav::-webkit-scrollbar { display: none; }
          .admin-nav-item {
            white-space: nowrap;
            border-left: none;
            border-bottom: 3px solid transparent;
            padding: 6px 10px;
          }
          .admin-nav-item.active {
            border-left-color: transparent;
            border-bottom-color: var(--cyan);
          }
          .admin-nav-sep { display: none; }
          .admin-sidebar-footer { padding: 8px 16px 10px; border-top: none; }
        }
      `}</style>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-logo">
            <Link href="/admin">DK Admin</Link>
            <span>Administrace</span>
          </div>
          <nav className="admin-nav">
            {NAV.map((item, i) =>
              item === null ? (
                <hr key={i} className="admin-nav-sep" />
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-item${isActive(item.href, item.exact) ? " active" : ""}`}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
          <div className="admin-sidebar-footer">
            <form action="/api/dk/v1/auth/logout" method="POST">
              <button type="submit" className="admin-logout">Odhlásit se</button>
            </form>
          </div>
        </aside>
        <main className="admin-content">
          {children}
        </main>
      </div>
    </>
  );
}
