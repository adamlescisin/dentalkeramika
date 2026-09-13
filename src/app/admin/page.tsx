import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "../../lib/admin-auth";

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

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: "var(--line)" }}>
        <Link href="/admin" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          DK Admin
        </Link>
        <form action="/api/dk/v1/auth/logout" method="POST">
          <button type="submit" className="text-sm" style={{ color: "var(--status-cancelled)" }}>Odhlásit</button>
        </form>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          Administrace
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </main>
  );
}
