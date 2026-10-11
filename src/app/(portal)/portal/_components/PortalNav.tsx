"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV: ({ href: string; label: string; exact?: boolean } | null)[] = [
  { href: "/portal/dashboard", label: "Přehled", exact: true },
  { href: "/portal/rezervace", label: "Rezervace" },
  { href: "/portal/profil", label: "Ordinace a účty" },
];

export function PortalNav({
  upcomingCount,
  contactPhone,
  supportEmail,
}: {
  upcomingCount: number;
  contactPhone?: string | null;
  supportEmail?: string | null;
}) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const hasContact = contactPhone || supportEmail;

  return (
    <>
      <div className="sidebar-section">
        {NAV.map((item, i) =>
          item === null ? (
            <div key={i} className="sidebar-sep" />
          ) : (
            <Link
              key={item.href}
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

      {hasContact && (
        <div className="sidebar-contact">
          {contactPhone && (
            <div className="sidebar-contact-item">
              <span className="sidebar-contact-label">Kontakt na specialistu</span>
              <a href={`tel:${contactPhone.replace(/\s/g, "")}`} className="sidebar-contact-value">
                {contactPhone}
              </a>
            </div>
          )}
          {supportEmail && (
            <div className="sidebar-contact-item">
              <span className="sidebar-contact-label">Podpora portálu</span>
              <a href={`mailto:${supportEmail}`} className="sidebar-contact-value">
                {supportEmail}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-bottom">
        <form action="/api/dk/v1/auth/logout" method="POST">
          <button type="submit">Odhlásit se</button>
        </form>
      </div>
    </>
  );
}
