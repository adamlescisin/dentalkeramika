"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV: ({ href: string; label: string; exact?: boolean } | null)[] = [
  { href: "/portal/dashboard", label: "Přehled", exact: true },
  { href: "/portal/rezervace", label: "Rezervace" },
  null,
  { href: "/portal/profil", label: "Ordinace a tým" },
  { href: "/portal/profil", label: "Přihlášení a bezpečnost" },
];

export function PortalNav({ upcomingCount }: { upcomingCount: number }) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <div className="sidebar-section">
        {NAV.map((item, i) =>
          item === null ? (
            <div key={i} className="sidebar-sep" />
          ) : (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`nav-item${isActive(item.href, item.exact) ? " active" : ""}`}
            >
              <span>{item.label}</span>
              {item.href === "/portal/rezervace" && upcomingCount > 0 && (
                <span className="nav-badge">{upcomingCount}</span>
              )}
            </Link>
          )
        )}
      </div>
      <div className="sidebar-bottom">
        <form action="/api/dk/v1/auth/logout" method="POST">
          <button type="submit">Odhlásit se</button>
        </form>
      </div>
    </>
  );
}
