import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "../../../lib/admin-auth";
import { db } from "../../../../db";
import { dk_technicians, dk_oauth_tokens } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminKalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; disconnected?: string; error?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/prihlasit");

  const technicians = await db
    .select({ id: dk_technicians.id, display_name: dk_technicians.display_name, google_calendar_id: dk_technicians.google_calendar_id })
    .from(dk_technicians)
    .where(eq(dk_technicians.active, true));

  const tokenRows = await db.select({ technician_id: dk_oauth_tokens.technician_id }).from(dk_oauth_tokens);
  const connectedIds = new Set(tokenRows.map((r) => r.technician_id));

  const params = await searchParams;
  const justConnected = params.connected === "1";
  const justDisconnected = params.disconnected === "1";
  const errorMsg = params.error ? decodeURIComponent(params.error) : null;

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: "var(--line)" }}>
        <Link href="/admin" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>DK Admin</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/admin" style={{ color: "var(--cyan-deep)" }}>← Zpět</Link>
          <form action="/api/dk/v1/auth/logout" method="POST">
            <button type="submit" className="text-sm" style={{ color: "var(--status-cancelled)" }}>Odhlásit</button>
          </form>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Google Kalendář</h1>
          <p className="text-sm" style={{ color: "#6b7f8a" }}>Propojte Google Kalendář každého technika.</p>
        </div>

        {justConnected && (
          <div className="rounded-xl p-4 border" style={{ background: "#f0faf5", borderColor: "#52c87a", color: "#1a6b3c" }}>
            Google Kalendář byl úspěšně propojen.
          </div>
        )}
        {justDisconnected && (
          <div className="rounded-xl p-4 border" style={{ background: "#fffbea", borderColor: "#f0d58a", color: "#7a5200" }}>
            Google Kalendář byl odpojen.
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl p-4 border" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
            Chyba: {errorMsg}
          </div>
        )}

        {technicians.length === 0 ? (
          <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
            Žádní aktivní technici. <Link href="/admin/technici" style={{ color: "var(--cyan-deep)" }}>Přidat technika</Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
            {technicians.map((tech) => {
              const isConnected = connectedIds.has(tech.id);
              return (
                <div key={tech.id} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{tech.display_name}</p>
                    {isConnected && tech.google_calendar_id ? (
                      <p className="text-xs mt-0.5 truncate" style={{ color: "#6b7f8a" }}>Propojeno · {tech.google_calendar_id}</p>
                    ) : isConnected ? (
                      <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>Propojeno</p>
                    ) : (
                      <p className="text-xs mt-0.5" style={{ color: "#b05a00" }}>Nepropojeno</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isConnected ? (
                      <>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#f0faf5", color: "#1a6b3c" }}>Aktivní</span>
                        <form action={`/api/dk/v1/google-oauth/disconnect?technician_id=${tech.id}`} method="POST">
                          <button type="submit" className="text-xs font-medium px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}>Odpojit</button>
                        </form>
                        <a href={`/api/dk/v1/google-oauth?technician_id=${tech.id}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Obnovit</a>
                      </>
                    ) : (
                      <a href={`/api/dk/v1/google-oauth?technician_id=${tech.id}`} className="text-sm font-semibold px-4 py-2 rounded-lg text-white" style={{ background: "var(--cyan)" }}>Propojit</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
