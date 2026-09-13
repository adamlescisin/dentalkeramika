"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Service = {
  id: string;
  code: string;
  name: string;
  duration_min: number;
  requires_approval: boolean;
};

type Location = {
  id: string;
  label: string;
  street: string;
  city: string;
  zip: string;
  is_default: boolean;
};

type Slot = { start: string; end: string };

type Step = "service" | "slot" | "details" | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayHeader(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("cs-CZ", { weekday: "short", timeZone: "Europe/Prague" }),
    day: d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "Europe/Prague" }),
  };
}

function startOfDay(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function groupByDay(slots: Slot[]): Record<string, Slot[]> {
  const out: Record<string, Slot[]> = {};
  for (const s of slots) {
    const day = new Date(s.start).toLocaleDateString("cs-CZ", {
      timeZone: "Europe/Prague",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    (out[day] ??= []).push(s);
  }
  return out;
}

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  a: "Skenování v ordinaci Praha. Technik přijede k vám.",
  b: "Skenování do 30 km od Prahy. Technik přijede k vám.",
  c: "Skenování do 100 km od Prahy. Technik přijede k vám.",
  d: "Celodenní pronájem skeneru s technikem. Vyžaduje individuální domluvu.",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingWizard({
  services,
  locations,
  isPending,
}: {
  services: Service[];
  locations: Location[];
  isPending: boolean;
}) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [location, setLocation] = useState<Location | null>(() =>
    locations.find((l) => l.is_default) ?? locations[0] ?? null
  );

  // Slot board state
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Details form state
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [patientName, setPatientName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Confirmation result
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [confirmedStatus, setConfirmedStatus] = useState<string | null>(null);

  // Week window
  const today = startOfDay(new Date());
  const weekStart = addDays(today, weekOffset * 7);
  const weekEnd = addDays(weekStart, 7);

  const fetchSlots = useCallback(async () => {
    if (!service || !location) return;
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot(null);

    const params = new URLSearchParams({
      service: service.id,
      location: location.id,
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
    });

    try {
      const res = await fetch(`/api/dk/v1/availability?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSlotsError(body.error ?? "Nepodařilo se načíst termíny.");
      } else {
        const json = await res.json();
        setSlots(json.data ?? []);
      }
    } catch {
      setSlotsError("Síťová chyba — zkuste to znovu.");
    } finally {
      setLoadingSlots(false);
    }
  }, [service, location, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === "slot") fetchSlots();
  }, [step, fetchSlots]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !location || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/dk/v1/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          serviceId: service.id,
          locationId: location.id,
          startsAt: selectedSlot.start,
          requesterName,
          requesterPhone,
          patientName: patientName || undefined,
          note: note || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setSubmitError(json.error ?? "Rezervaci se nepodařilo vytvořit.");
      } else {
        setConfirmedId(json.id);
        setConfirmedStatus(json.status);
        setStep("done");
      }
    } catch {
      setSubmitError("Síťová chyba — zkuste to znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Grouped slot board ────────────────────────────────────────────────────

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = groupByDay(slots);

  function dayKey(d: Date) {
    return d.toLocaleDateString("cs-CZ", {
      timeZone: "Europe/Prague",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const stepNum = step === "service" ? 1 : step === "slot" ? 2 : step === "details" ? 3 : 4;

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4 border-b bg-white"
        style={{ borderColor: "var(--line)" }}
      >
        <Link href="/" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          DentálníKeramika
        </Link>
        <Link href="/portal/dashboard" className="text-sm" style={{ color: "var(--cyan-deep)" }}>
          Dashboard
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Pending warning */}
        {isPending && (
          <div className="rounded-xl p-4 border mb-6" style={{ background: "#fffbea", borderColor: "#f0d58a", color: "#7a5200" }}>
            Váš účet čeká na schválení. Rezervace zatím nejsou dostupné.
          </div>
        )}

        {/* Step indicator */}
        {step !== "done" && (
          <div className="flex items-center gap-3 mb-8">
            {(["service", "slot", "details"] as const).map((s, i) => {
              const n = i + 1;
              const active = stepNum === n;
              const done = stepNum > n;
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="h-px w-6 flex-shrink-0" style={{ background: "var(--line)" }} />}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: done ? "var(--cyan)" : active ? "var(--ink)" : "var(--line)",
                        color: done || active ? "#fff" : "#6b7f8a",
                      }}
                    >
                      {done ? "✓" : n}
                    </div>
                    <span
                      className="text-sm hidden sm:inline"
                      style={{ color: active ? "var(--ink)" : "#6b7f8a", fontWeight: active ? 600 : 400 }}
                    >
                      {s === "service" ? "Služba" : s === "slot" ? "Termín" : "Kontakt"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STEP 1: Service ── */}
        {step === "service" && (
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
              Vyberte službu
            </h1>
            <p className="text-sm mb-6" style={{ color: "#6b7f8a" }}>
              Zvolte typ skenování podle vzdálenosti vaší ordinace.
            </p>
            <div className="flex flex-col gap-3">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  disabled={isPending}
                  onClick={() => {
                    setService(svc);
                    setStep("slot");
                  }}
                  className="text-left bg-white border rounded-xl px-5 py-4 hover:border-[var(--cyan)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-base" style={{ color: "var(--ink)" }}>
                        {svc.name}
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: "#6b7f8a" }}>
                        {SERVICE_DESCRIPTIONS[svc.code] ?? ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-medium" style={{ color: "#4a5f6a" }}>
                        {svc.duration_min} min
                      </span>
                      {svc.requires_approval && (
                        <p className="text-xs mt-0.5" style={{ color: "#b05a00" }}>Vyžaduje schválení</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Slot ── */}
        {step === "slot" && service && (
          <div>
            <button
              onClick={() => setStep("service")}
              className="text-sm mb-4 flex items-center gap-1"
              style={{ color: "var(--cyan-deep)" }}
            >
              ← Zpět
            </button>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
              Vyberte termín
            </h1>
            <p className="text-sm mb-5" style={{ color: "#6b7f8a" }}>
              {service.name} · {service.duration_min} min
            </p>

            {/* Location picker */}
            {locations.length > 1 && (
              <div className="mb-5">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                  Ordinace
                </label>
                <select
                  value={location?.id ?? ""}
                  onChange={(e) => {
                    const loc = locations.find((l) => l.id === e.target.value) ?? null;
                    setLocation(loc);
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.label} — {loc.street}, {loc.city}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {locations.length === 1 && location && (
              <div className="mb-5 text-sm rounded-lg px-4 py-3 border bg-white" style={{ borderColor: "var(--line)", color: "#4a5f6a" }}>
                <span className="font-semibold" style={{ color: "var(--ink)" }}>{location.label}</span>
                {" — "}{location.street}, {location.city}
              </div>
            )}
            {locations.length === 0 && (
              <div className="mb-5 rounded-xl p-4 border" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
                Nemáte přidanou žádnou ordinaci. Přidejte ji v{" "}
                <Link href="/portal/profil" style={{ color: "var(--cyan-deep)" }}>profilu ordinace</Link>.
              </div>
            )}

            {/* Week navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                disabled={weekOffset === 0}
                onClick={() => setWeekOffset((w) => w - 1)}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border disabled:opacity-30"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                ← Předchozí týden
              </button>
              <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {weekStart.toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
                {" – "}
                {addDays(weekStart, 6).toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
              </span>
              <button
                disabled={weekOffset >= 12}
                onClick={() => setWeekOffset((w) => w + 1)}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border disabled:opacity-30"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                Další týden →
              </button>
            </div>

            {/* Slot grid */}
            {loadingSlots ? (
              <div className="flex justify-center py-12">
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--cyan)" }}
                />
              </div>
            ) : slotsError ? (
              <div className="rounded-xl p-4 border text-center" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
                {slotsError}
                <button onClick={fetchSlots} className="ml-3 underline text-sm">Zkusit znovu</button>
              </div>
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: "var(--line)" }}>
                <div className="grid grid-cols-7 divide-x" style={{ borderColor: "var(--line)" }}>
                  {days.map((day) => {
                    const key = dayKey(day);
                    const daySlots = byDay[key] ?? [];
                    const isToday = isoDay(day) === isoDay(today);
                    const isPast = day < today;
                    const { weekday, day: dayNum } = formatDayHeader(day.toISOString());
                    return (
                      <div key={key} className="min-h-[200px]">
                        {/* Day header */}
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
                        {/* Slot buttons */}
                        <div className="flex flex-col gap-1 p-1">
                          {isPast ? null : daySlots.length === 0 ? (
                            <p className="text-center py-4 text-xs" style={{ color: "#b0bec5" }}>–</p>
                          ) : (
                            daySlots.map((slot) => {
                              const isSelected = selectedSlot?.start === slot.start;
                              return (
                                <button
                                  key={slot.start}
                                  onClick={() => setSelectedSlot(slot)}
                                  className="w-full text-center text-xs font-medium rounded-md py-1.5 transition-colors"
                                  style={{
                                    background: isSelected ? "var(--cyan)" : "var(--porcelain)",
                                    color: isSelected ? "#fff" : "var(--ink)",
                                    border: isSelected ? "none" : "1px solid transparent",
                                  }}
                                >
                                  {formatTime(slot.start)}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Proceed */}
            <div className="mt-5 flex justify-end">
              <button
                disabled={!selectedSlot || locations.length === 0}
                onClick={() => setStep("details")}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--cyan)" }}
              >
                Pokračovat →
              </button>
            </div>

            {selectedSlot && (
              <p className="text-right text-xs mt-2" style={{ color: "#6b7f8a" }}>
                Vybraný termín:{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {new Date(selectedSlot.start).toLocaleString("cs-CZ", {
                    timeZone: "Europe/Prague",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </p>
            )}
          </div>
        )}

        {/* ── STEP 3: Details ── */}
        {step === "details" && service && location && selectedSlot && (
          <div>
            <button
              onClick={() => setStep("slot")}
              className="text-sm mb-4 flex items-center gap-1"
              style={{ color: "var(--cyan-deep)" }}
            >
              ← Zpět
            </button>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
              Kontaktní údaje
            </h1>

            {/* Summary */}
            <div className="rounded-xl border p-4 mb-6 bg-white" style={{ borderColor: "var(--line)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{service.name}</p>
              <p className="text-sm mt-0.5" style={{ color: "#4a5f6a" }}>
                {new Date(selectedSlot.start).toLocaleString("cs-CZ", {
                  timeZone: "Europe/Prague",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-sm mt-0.5" style={{ color: "#6b7f8a" }}>
                {location.label} — {location.street}, {location.city}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Jméno objednavatele *"
                  value={requesterName}
                  onChange={setRequesterName}
                  placeholder="MUDr. Jana Nováková"
                  required
                />
                <Field
                  label="Telefon *"
                  value={requesterPhone}
                  onChange={setRequesterPhone}
                  placeholder="+420 777 888 999"
                  type="tel"
                  required
                />
              </div>
              <Field
                label="Jméno pacienta (nepovinné)"
                value={patientName}
                onChange={setPatientName}
                placeholder="Jan Novák"
                hint="Zobrazí se pouze technikovi v popisu události. Nebude v e-mailu."
              />
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                  Poznámka pro technika
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Např. kódy do budovy, specifické požadavky…"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white resize-none"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                />
              </div>

              {submitError && (
                <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
                  {submitError}
                </div>
              )}

              {service.requires_approval && (
                <div className="rounded-xl p-3 border text-sm" style={{ background: "#fffbea", borderColor: "#f0d58a", color: "#7a5200" }}>
                  Tato rezervace vyžaduje schválení. Po odeslání vás budeme kontaktovat.
                </div>
              )}

              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={submitting || !requesterName || !requesterPhone}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "var(--cyan)" }}
                >
                  {submitting ? "Odesílám…" : "Odeslat rezervaci"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === "done" && confirmedId && (
          <div className="text-center py-10">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl"
              style={{ background: "#f0faf5" }}
            >
              ✓
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
              {confirmedStatus === "confirmed" ? "Rezervace potvrzena" : "Žádost odeslána"}
            </h1>
            <p className="text-base mb-6" style={{ color: "#4a5f6a" }}>
              {confirmedStatus === "confirmed"
                ? "Technik se na vás těší. Potvrzení najdete v e-mailu."
                : "Vaši žádost zpracujeme a ozveme se vám."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/portal/dashboard"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--cyan)" }}
              >
                Zpět na dashboard
              </Link>
              <button
                onClick={() => {
                  setStep("service");
                  setService(null);
                  setSelectedSlot(null);
                  setWeekOffset(0);
                  setRequesterName("");
                  setRequesterPhone("");
                  setPatientName("");
                  setNote("");
                  setConfirmedId(null);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold border"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                Nová rezervace
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
      />
      {hint && <p className="text-xs mt-1" style={{ color: "#6b7f8a" }}>{hint}</p>}
    </div>
  );
}
