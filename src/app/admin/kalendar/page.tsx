"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Tech = {
  id: string;
  display_name: string;
  google_calendar_id: string | null;
  active: boolean;
  connected: boolean;
};

type GCalendar = { id: string; summary: string; primary: boolean };

function AdminNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: "var(--line)" }}>
      <Link href="/admin" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>DK Admin</Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/admin" style={{ color: "var(--cyan-deep)" }}>← Zpět</Link>
        <form action="/api/dk/v1/auth/logout" method="POST">
          <button type="submit" className="text-sm" style={{ color: "var(--status-cancelled)" }}>Odhlásit</button>
        </form>
      </div>
    </nav>
  );
}

function CalendarPickerPanel({
  techId,
  techName,
  onDone,
}: {
  techId: string;
  techName: string;
  onDone: () => void;
}) {
  const [calendars, setCalendars] = useState<GCalendar[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dk/v1/admin/technicians/${techId}/calendars`)
      .then((r) => r.json())
      .then((json) => {
        const list: GCalendar[] = json.data ?? [];
        setCalendars(list);
        const primary = list.find((c) => c.primary);
        if (primary) setSelected(primary.id);
        else if (list[0]) setSelected(list[0].id);
      })
      .catch(() => setError("Nepodařilo se načíst seznam kalendářů."))
      .finally(() => setLoading(false));
  }, [techId]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/dk/v1/admin/technicians/${techId}/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId: selected }),
    });
    if (res.ok) {
      onDone();
    } else {
      const b = await res.json().catch(() => ({}));
      setError((b as { error?: string }).error ?? "Uložení se nezdařilo.");
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-6 flex flex-col gap-4" style={{ borderColor: "var(--line)" }}>
      <div>
        <p className="text-base font-semibold" style={{ color: "var(--ink)" }}>{techName}</p>
        <p className="text-sm mt-0.5" style={{ color: "#6b7f8a" }}>Vyberte, do kterého kalendáře se budou zapisovat termíny.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} />
        </div>
      ) : error ? (
        <div className="rounded-lg p-3 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{error}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {calendars.map((cal) => (
            <label
              key={cal.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors"
              style={{
                borderColor: selected === cal.id ? "var(--cyan)" : "var(--line)",
                background: selected === cal.id ? "#f0fafb" : "#fff",
              }}
            >
              <input
                type="radio"
                name="calendar"
                value={cal.id}
                checked={selected === cal.id}
                onChange={() => setSelected(cal.id)}
                className="shrink-0"
                style={{ accentColor: "var(--cyan)" }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{cal.summary}</p>
                {cal.primary && <p className="text-xs" style={{ color: "#6b7f8a" }}>Primární kalendář</p>}
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={onDone}
          className="text-sm px-4 py-2 rounded-lg border"
          style={{ borderColor: "var(--line)", color: "#6b7f8a" }}
        >
          Zrušit
        </button>
        <button
          onClick={save}
          disabled={saving || !selected || loading}
          className="text-sm font-semibold px-5 py-2 rounded-lg text-white disabled:opacity-40"
          style={{ background: "var(--cyan)" }}
        >
          {saving ? "Ukládám…" : "Potvrdit výběr"}
        </button>
      </div>
    </div>
  );
}

function KalendarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickId = searchParams.get("pick");
  const justConnected = searchParams.get("connected") === "1";
  const justDisconnected = searchParams.get("disconnected") === "1";
  const errorMsg = searchParams.get("error") ? decodeURIComponent(searchParams.get("error")!) : null;

  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePick, setActivePick] = useState<string | null>(pickId);
  const [testResults, setTestResults] = useState<Record<string, "testing" | "ok" | string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dk/v1/admin/technicians");
    const json = await res.json();
    setTechs(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function testConnection(tech: Tech) {
    setTestResults((prev) => ({ ...prev, [tech.id]: "testing" }));
    try {
      const res = await fetch(`/api/dk/v1/admin/technicians/${tech.id}/calendars`);
      if (res.ok) {
        setTestResults((prev) => ({ ...prev, [tech.id]: "ok" }));
      } else {
        const b = await res.json().catch(() => ({}));
        setTestResults((prev) => ({ ...prev, [tech.id]: (b as { error?: string }).error ?? "Chyba" }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [tech.id]: "Síťová chyba" }));
    }
  }

  function handlePickDone() {
    setActivePick(null);
    router.replace("/admin/kalendar?connected=1");
    load();
  }

  const pickTech = techs.find((t) => t.id === activePick);

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <AdminNav />
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Google Kalendář</h1>
          <p className="text-sm" style={{ color: "#6b7f8a" }}>Propojte Google Kalendář každého technika.</p>
        </div>

        {justConnected && !activePick && (
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

        {/* Calendar picker — shown right after OAuth connect or on "Vybrat jiný" */}
        {activePick && pickTech && (
          <CalendarPickerPanel
            techId={activePick}
            techName={pickTech.display_name}
            onDone={handlePickDone}
          />
        )}
        {activePick && !pickTech && !loading && (
          <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
            Technik nenalezen.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} />
          </div>
        ) : techs.length === 0 ? (
          <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
            Žádní aktivní technici. <Link href="/admin/technici" style={{ color: "var(--cyan-deep)" }}>Přidat technika</Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
            {techs.map((tech) => (
              <div key={tech.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{tech.display_name}</p>
                  {tech.connected && tech.google_calendar_id ? (
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#6b7f8a" }}>
                      Propojeno · {tech.google_calendar_id}
                    </p>
                  ) : tech.connected ? (
                    <p className="text-xs mt-0.5" style={{ color: "#b05a00" }}>Propojeno — kalendář nevybrán</p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: "#b05a00" }}>Nepropojeno</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {tech.connected ? (
                    <>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#f0faf5", color: "#1a6b3c" }}>Aktivní</span>
                      {testResults[tech.id] === "testing" ? (
                        <span className="text-xs" style={{ color: "#6b7f8a" }}>Testuji…</span>
                      ) : testResults[tech.id] === "ok" ? (
                        <span className="text-xs font-medium" style={{ color: "#1a6b3c" }}>✓ Připojení OK</span>
                      ) : testResults[tech.id] ? (
                        <span className="text-xs font-medium" style={{ color: "var(--status-cancelled)" }}>✗ {testResults[tech.id]}</span>
                      ) : (
                        <button
                          onClick={() => testConnection(tech)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                          style={{ borderColor: "var(--line)", color: "#6b7f8a" }}
                        >
                          Otestovat
                        </button>
                      )}
                      <button
                        onClick={() => setActivePick(tech.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                        style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
                      >
                        Vybrat kalendář
                      </button>
                      <form action={`/api/dk/v1/google-oauth/disconnect?technician_id=${tech.id}`} method="POST">
                        <button type="submit" className="text-xs font-medium px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}>
                          Odpojit
                        </button>
                      </form>
                    </>
                  ) : (
                    <a
                      href={`/api/dk/v1/google-oauth?technician_id=${tech.id}`}
                      className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
                      style={{ background: "var(--cyan)" }}
                    >
                      Propojit
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminKalendarPage() {
  return (
    <Suspense>
      <KalendarPageInner />
    </Suspense>
  );
}
