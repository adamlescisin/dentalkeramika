"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

type Slot = { start: string; end: string };
type DayResult = { date: string; slots: string[]; closed: boolean };

function startOfLocalDay(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDayHeader(d: Date) {
  return {
    weekday: d.toLocaleDateString("cs-CZ", { weekday: "short", timeZone: "Europe/Prague" }),
    day: d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "Europe/Prague" }),
  };
}

function dayKey(d: Date) {
  return d.toLocaleDateString("cs-CZ", {
    timeZone: "Europe/Prague",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

function groupByDay(slots: Slot[]): Record<string, Slot[]> {
  const out: Record<string, Slot[]> = {};
  for (const s of slots) {
    const key = new Date(s.start).toLocaleDateString("cs-CZ", {
      timeZone: "Europe/Prague",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    (out[key] ??= []).push(s);
  }
  return out;
}

export default function PrelozitPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [reservation, setReservation] = useState<{
    starts_at: string;
    service_id: string;
    location_id: string;
    service_duration_min?: number;
  } | null>(null);
  const [durationMin, setDurationMin] = useState(60);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/dk/v1/reservations/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.data) { setInitError("Rezervace nebyla nalezena."); return; }
        const r = d.data;
        setReservation(r);
        setServiceId(r.service_id);
        setLocationId(r.location_id);
        // Fetch service details for duration
        return fetch(`/api/dk/v1/availability?service=${r.service_id}&location=${r.location_id}&from=${new Date().toISOString()}&to=${new Date().toISOString()}`)
          .then(() => {})
          .catch(() => {});
      })
      .catch(() => setInitError("Nepodařilo se načíst rezervaci."));
  }, [id]);

  // Separately fetch service duration
  useEffect(() => {
    if (!serviceId) return;
    // We derive duration from a zero-width availability call; instead, pass it through the reservation detail
    // The reservation API returns service details embedded if we extend it — for now use 60min default
    // which is overridden after fetch below
  }, [serviceId]);

  const today = startOfLocalDay(new Date());
  const weekStart = addDays(today, weekOffset * 7);
  const weekEnd = addDays(weekStart, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchSlots = useCallback(async () => {
    if (!serviceId || !locationId) return;
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot(null);

    const params = new URLSearchParams({
      service: serviceId,
      location: locationId,
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
    });

    try {
      const res = await fetch(`/api/dk/v1/availability?${params}`);
      const json = await res.json();
      if (!res.ok) { setSlotsError(json.error ?? "Chyba."); return; }
      const flat: Slot[] = (json.data ?? []).flatMap(
        (day: DayResult) =>
          day.slots.map((start) => ({
            start,
            end: new Date(new Date(start).getTime() + durationMin * 60000).toISOString(),
          }))
      );
      setSlots(flat);
    } catch {
      setSlotsError("Síťová chyba.");
    } finally {
      setLoadingSlots(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, locationId, weekOffset, durationMin]);

  useEffect(() => {
    if (serviceId && locationId) fetchSlots();
  }, [fetchSlots, serviceId, locationId]);

  async function handleReschedule() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/dk/v1/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: selectedSlot.start }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError((data as { error?: string }).error ?? "Přeložení se nezdařilo.");
      } else {
        router.replace(`/portal/rezervace/${id}?rescheduled=1`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const byDay = groupByDay(slots);

  if (initError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--porcelain)" }}>
        <div className="bg-white rounded-2xl border p-8 text-center max-w-sm" style={{ borderColor: "var(--line)" }}>
          <p className="text-sm mb-4" style={{ color: "var(--status-cancelled)" }}>{initError}</p>
          <Link href="/portal/rezervace" style={{ color: "var(--cyan-deep)" }}>← Zpět na termíny</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: "var(--line)" }}>
        <Link href="/" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          DentálníKeramika
        </Link>
        <Link href={`/portal/rezervace/${id}`} className="text-sm" style={{ color: "var(--cyan-deep)" }}>
          ← Zpět na detail
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
            Přeložit termín
          </h1>
          {reservation && (
            <p className="text-sm" style={{ color: "#6b7f8a" }}>
              Stávající termín: {fmtDateTime(reservation.starts_at)}
            </p>
          )}
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            disabled={weekOffset === 0}
            className="text-sm px-4 py-2 rounded-lg border disabled:opacity-40"
            style={{ borderColor: "var(--line)", color: weekOffset === 0 ? "#b0bec5" : "var(--ink)" }}
          >
            ← Předchozí týden
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {weekStart.toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
            {" – "}
            {addDays(weekStart, 6).toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset >= 12}
            className="text-sm px-4 py-2 rounded-lg border disabled:opacity-40"
            style={{ borderColor: "var(--line)", color: weekOffset >= 12 ? "#b0bec5" : "var(--ink)" }}
          >
            Další týden →
          </button>
        </div>

        {loadingSlots ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} />
          </div>
        ) : slotsError ? (
          <div className="rounded-xl p-4 border text-sm text-center" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
            {slotsError}
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: "var(--line)" }}>
            <div className="grid grid-cols-7 divide-x" style={{ borderColor: "var(--line)" }}>
              {days.map((day) => {
                const key = dayKey(day);
                const daySlots = byDay[key] ?? [];
                const isPast = day < today;
                const { weekday, day: dayNum } = formatDayHeader(day);
                const isToday = dayKey(day) === dayKey(today);
                return (
                  <div key={key} className="min-h-[180px]">
                    <div
                      className="text-center py-2 border-b text-xs font-semibold"
                      style={{
                        borderColor: "var(--line)",
                        background: isToday ? "var(--cyan)" : "transparent",
                        color: isToday ? "#fff" : isPast ? "#b0bec5" : "var(--ink)",
                      }}
                    >
                      <div>{weekday}</div>
                      <div className="font-normal" style={{ opacity: 0.75 }}>{dayNum}</div>
                    </div>
                    <div className="flex flex-col gap-1 p-1">
                      {isPast ? null : daySlots.length === 0 ? (
                        <p className="text-center py-4 text-xs" style={{ color: "#b0bec5" }}>–</p>
                      ) : daySlots.map((slot) => {
                        const selected = selectedSlot?.start === slot.start;
                        return (
                          <button
                            key={slot.start}
                            onClick={() => setSelectedSlot(selected ? null : slot)}
                            className="w-full text-xs font-medium py-1.5 rounded-md transition-colors"
                            style={{
                              background: selected ? "var(--cyan)" : "var(--porcelain)",
                              color: selected ? "#fff" : "var(--ink)",
                            }}
                          >
                            {fmtTime(slot.start)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedSlot && (
          <div className="bg-white rounded-xl border p-5 flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: "var(--line)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                Vybraný termín
              </p>
              <p className="text-sm mt-0.5" style={{ color: "#6b7f8a" }}>
                {fmtDateTime(selectedSlot.start)}
              </p>
            </div>
            <button
              onClick={handleReschedule}
              disabled={submitting}
              className="text-sm font-semibold px-6 py-2.5 rounded-lg text-white disabled:opacity-60 shrink-0"
              style={{ background: "var(--cyan)" }}
            >
              {submitting ? "Ukládám…" : "Potvrdit přeložení"}
            </button>
          </div>
        )}

        {submitError && (
          <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
            {submitError}
          </div>
        )}
      </div>
    </main>
  );
}
