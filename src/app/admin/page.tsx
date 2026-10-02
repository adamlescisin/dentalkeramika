import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "../../lib/admin-auth";
import { AdminShell } from "./_components/AdminShell";
import { db } from "../../../db";
import { dk_accounts, dk_reservations } from "../../../db/schema";
import { count, and, gte, lt, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/technici",     label: "Technici",            desc: "Správa techniků a jejich aktivace" },
  { href: "/admin/kalendar",     label: "Google Kalendář",     desc: "Propojení kalendářů techniků" },
  { href: "/admin/pracovni-doba",label: "Pracovní doba",       desc: "Dostupné hodiny každého technika" },
  { href: "/admin/sluzby",       label: "Služby",              desc: "CRUD ceníku, délky a příznaků" },
  { href: "/admin/ordinace",     label: "Ordinace",            desc: "Schvalování a správa klientských účtů" },
  { href: "/admin/rezervace",    label: "Čekající rezervace",  desc: "Potvrzení nebo odmítnutí rezervací" },
  { href: "/admin/nastaveni",    label: "Nastavení",           desc: "Globální pravidla rezervačního systému" },
];

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/prihlasit");

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [[{ total: practiceCount }], [{ total: reservationCount }], [{ total: nextWeekCount }]] = await Promise.all([
    db.select({ total: count() }).from(dk_accounts),
    db.select({ total: count() }).from(dk_reservations).where(ne(dk_reservations.status, "cancelled")),
    db.select({ total: count() }).from(dk_reservations).where(
      and(
        gte(dk_reservations.starts_at, now),
        lt(dk_reservations.starts_at, in7Days),
        ne(dk_reservations.status, "cancelled"),
      )
    ),
  ]);

  const tiles = [
    { label: "Počet ordinací",   value: practiceCount,   href: "/admin/ordinace",   accent: "#1a3a7a", bg: "#f0f4ff", border: "#d0daf8" },
    { label: "Celkem rezervací", value: reservationCount, href: "/admin/rezervace",  accent: "#1a6b3c", bg: "#f0faf5", border: "#b8e8d0" },
    { label: "Další týden",      value: nextWeekCount,    href: "/admin/rezervace",  accent: "#7a5200", bg: "#fffbea", border: "#f0d88a" },
  ];

  return (
    <AdminShell>
      <div className="px-8 py-10 flex flex-col gap-10">

        {/* Summary tiles */}
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Přehled</h1>
          <p className="text-sm mb-6" style={{ color: "#6b7f8a" }}>Souhrn stavu systému.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            {tiles.map((t) => (
              <Link key={t.label} href={t.href}
                className="rounded-xl border px-5 py-4 flex flex-col gap-1 transition-opacity hover:opacity-80"
                style={{ background: t.bg, borderColor: t.border }}>
                <p className="text-xs font-medium" style={{ color: t.accent }}>{t.label}</p>
                <p className="text-4xl font-bold tabular-nums mt-1" style={{ color: t.accent, fontVariationSettings: "'wdth' 112" }}>
                  {t.value}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Navigation sections */}
        <div>
          <p className="text-sm font-semibold mb-4" style={{ color: "#6b7f8a" }}>Sekce</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="bg-white rounded-xl border px-5 py-4 flex flex-col gap-1 hover:border-[var(--cyan)] transition-colors"
                style={{ borderColor: "var(--line)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{s.label}</p>
                <p className="text-xs" style={{ color: "#6b7f8a" }}>{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </AdminShell>
  );
}
