"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DAYS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri open by default
const DEFAULT_OPEN = "08:00";
const DEFAULT_CLOSE = "17:00";

type DayState = {
  weekday: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
};

type Technician = {
  id: string;
  display_name: string;
  google_calendar_id: string | null;
};

type HourRow = {
  technician_id: string;
  weekday: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

function defaultWeek(): DayState[] {
  return Array.from({ length: 7 }, (_, i) => ({
    weekday: i,
    is_open: WEEKDAYS.includes(i),
    opens_at: DEFAULT_OPEN,
    closes_at: DEFAULT_CLOSE,
  }));
}

function hoursToWeek(rows: HourRow[], techId: string): DayState[] {
  const week = defaultWeek();
  for (const row of rows) {
    if (row.technician_id !== techId) continue;
    week[row.weekday] = {
      weekday: row.weekday,
      is_open: row.is_open,
      opens_at: row.opens_at ?? DEFAULT_OPEN,
      closes_at: row.closes_at ?? DEFAULT_CLOSE,
    };
  }
  return week;
}

export default function WorkingHoursEditor() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [week, setWeek] = useState<DayState[]>(defaultWeek());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allHours, setAllHours] = useState<HourRow[]>([]);

  useEffect(() => {
    fetch("/api/dk/v1/working-hours")
      .then((r) => r.json())
      .then((data) => {
        setTechnicians(data.technicians ?? []);
        setAllHours(data.hours ?? []);
        const first = data.technicians?.[0];
        if (first) {
          setSelectedTechId(first.id);
          setWeek(hoursToWeek(data.hours ?? [], first.id));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Nepodařilo se načíst data.");
        setLoading(false);
      });
  }, []);

  function selectTech(id: string) {
    setSelectedTechId(id);
    setWeek(hoursToWeek(allHours, id));
    setSaved(false);
  }

  function setDay(weekday: number, patch: Partial<DayState>) {
    setWeek((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d))
    );
    setSaved(false);
  }

  async function handleSave() {
    if (!selectedTechId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/dk/v1/working-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianId: selectedTechId, days: week }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      // Update local cache
      const fresh = allHours.filter((h) => h.technician_id !== selectedTechId);
      setAllHours([
        ...fresh,
        ...week.map((d) => ({
          technician_id: selectedTechId,
          weekday: d.weekday,
          is_open: d.is_open,
          opens_at: d.is_open ? d.opens_at : null,
          closes_at: d.is_open ? d.closes_at : null,
        })),
      ]);
    } else {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? "Uložení se nezdařilo.");
    }
  }

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <nav
        className="flex items-center justify-between px-6 py-4 border-b bg-white"
        style={{ borderColor: "var(--line)" }}
      >
        <Link href="/" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          DentálníKeramika
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/portal/dashboard" style={{ color: "var(--cyan-deep)" }}>Dashboard</Link>
          <form action="/api/dk/v1/auth/logout" method="POST">
            <button type="submit" className="text-sm" style={{ color: "var(--status-cancelled)" }}>Odhlásit</button>
          </form>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
            Pracovní doba
          </h1>
          <p className="text-sm" style={{ color: "#6b7f8a" }}>
            Nastavte dostupné hodiny pro každého technika. Změna se projeví okamžitě v rezervačním wizardu.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} />
          </div>
        ) : technicians.length === 0 ? (
          <div className="bg-white rounded-xl border p-6 text-center" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
            Žádní aktivní technici. Spusťte nejprve SQL seed skript.
            <pre className="mt-3 text-xs text-left bg-gray-50 rounded p-3 overflow-x-auto" style={{ color: "#4a5f6a" }}>
              psql "$DATABASE_URL_UNPOOLED" -f db/migrations/0001_seed_technician.sql
            </pre>
          </div>
        ) : (
          <>
            {/* Technician tabs */}
            {technicians.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {technicians.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTech(t.id)}
                    className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
                    style={{
                      background: selectedTechId === t.id ? "var(--ink)" : "#fff",
                      color: selectedTechId === t.id ? "#fff" : "var(--ink)",
                      borderColor: selectedTechId === t.id ? "var(--ink)" : "var(--line)",
                    }}
                  >
                    {t.display_name}
                  </button>
                ))}
              </div>
            )}

            {/* Week grid */}
            <div className="bg-white rounded-xl border overflow-hidden divide-y" style={{ borderColor: "var(--line)" }}>
              {week.map((day) => (
                <div key={day.weekday} className="flex items-center gap-4 px-5 py-3">
                  {/* Toggle */}
                  <label className="flex items-center gap-2 w-20 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={day.is_open}
                      onChange={(e) => setDay(day.weekday, { is_open: e.target.checked })}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: "var(--cyan)" }}
                    />
                    <span className="text-sm font-semibold" style={{ color: day.is_open ? "var(--ink)" : "#b0bec5" }}>
                      {DAYS[day.weekday]}
                    </span>
                  </label>

                  {day.is_open ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={day.opens_at}
                        onChange={(e) => setDay(day.weekday, { opens_at: e.target.value })}
                        className="border rounded-lg px-3 py-1.5 text-sm"
                        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                      />
                      <span className="text-sm" style={{ color: "#6b7f8a" }}>–</span>
                      <input
                        type="time"
                        value={day.closes_at}
                        onChange={(e) => setDay(day.weekday, { closes_at: e.target.value })}
                        className="border rounded-lg px-3 py-1.5 text-sm"
                        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                      />
                      <span className="text-xs ml-1" style={{ color: "#6b7f8a" }}>
                        {(() => {
                          const [oh, om] = day.opens_at.split(":").map(Number);
                          const [ch, cm] = day.closes_at.split(":").map(Number);
                          const mins = (ch * 60 + cm) - (oh * 60 + om);
                          if (mins <= 0) return "";
                          const h = Math.floor(mins / 60);
                          const m = mins % 60;
                          return m === 0 ? `${h} h` : `${h} h ${m} min`;
                        })()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm flex-1" style={{ color: "#b0bec5" }}>Zavřeno</span>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
                {error}
              </div>
            )}

            {saved && (
              <div className="rounded-xl p-4 border text-sm" style={{ background: "#f0faf5", borderColor: "#52c87a", color: "#1a6b3c" }}>
                Uloženo. Volné termíny se aktualizují okamžitě.
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--cyan)" }}
              >
                {saving ? "Ukládám…" : "Uložit pracovní dobu"}
              </button>
            </div>
          </>
        )}

        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>Poznámky</h2>
          <ul className="text-sm space-y-1.5 list-disc list-inside" style={{ color: "#4a5f6a" }}>
            <li>Rezervace Praha (služba A) začínají nejdříve v 08:30 — buffer před prvním skenem je 30 min.</li>
            <li>Výjimky (svátky, dovolená) nastavíte přes Neon SQL nebo přímo v Google Kalendáři technika.</li>
            <li>Změna pracovní doby se projeví okamžitě — existující rezervace zůstávají nedotčeny.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
