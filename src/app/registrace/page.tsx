"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

type Step = 1 | 2;

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — person
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);

  // Step 2 — practice
  const [practiceName, setPracticeName] = useState("");
  const [ico, setIco] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationStreet, setLocationStreet] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationZip, setLocationZip] = useState("");
  const [locationAccessNote, setLocationAccessNote] = useState("");

  // ARES auto-fill (Czech company registry)
  async function lookupIco() {
    if (!ico || ico.length < 7) return;
    try {
      const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.obchodniJmeno) setPracticeName(data.obchodniJmeno);
      const addr = data.sidlo;
      if (addr) {
        setLocationStreet(`${addr.nazevUlice ?? ""} ${addr.cisloDomovni ?? ""}`.trim());
        setLocationCity(addr.nazevObce ?? "");
        setLocationZip(String(addr.psc ?? ""));
      }
    } catch {
      // ARES unavailable — user fills manually
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dk/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          password,
          practiceName,
          ico,
          billingEmail: billingEmail || email,
          locationLabel: locationLabel || practiceName,
          locationStreet,
          locationCity,
          locationZip,
          locationAccessNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registrace se nezdařila.");
      } else {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--porcelain)" }}>
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border p-8 text-center" style={{ borderColor: "var(--line)" }}>
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--ink)" }}>Registrace přijata</h1>
          <p className="text-sm" style={{ color: "#4a5f6a" }}>
            Zkontrolujte svůj e-mail a klikněte na ověřovací odkaz. Po ověření
            vás budeme co nejdříve aktivovat — obvykle ten samý pracovní den.
          </p>
        </div>
      </main>
    );
  }

  const inputClass = "border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 w-full";
  const inputStyle = { borderColor: "var(--line)", color: "var(--ink)" };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--porcelain)" }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: "var(--line)" }}>
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="flex items-center gap-2"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: step >= n ? "var(--cyan)" : "var(--line)",
                  color: step >= n ? "#fff" : "var(--ink)",
                }}
              >
                {n}
              </div>
              {n < 2 && <div className="flex-1 h-px w-8" style={{ background: step > n ? "var(--cyan)" : "var(--line)" }} />}
            </div>
          ))}
          <span className="ml-2 text-sm" style={{ color: "#4a5f6a" }}>
            {step === 1 ? "Osobní údaje" : "Ordinace"}
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          {step === 1 ? "Vytvořit účet" : "Údaje ordinace"}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Jméno</label>
                  <input required className={inputClass} style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Příjmení</label>
                  <input required className={inputClass} style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Pracovní e-mail</label>
                <input required type="email" className={inputClass} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="vas@ordinace.cz" />
                <span className="text-xs" style={{ color: "#6b7f8a" }}>Tento e-mail bude vaším přihlašovacím jménem.</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Telefon</label>
                <input type="tel" className={inputClass} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+420 602 ..." />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Heslo</label>
                <input required type="password" minLength={10} className={inputClass} style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} />
                <span className="text-xs" style={{ color: "#6b7f8a" }}>Alespoň 10 znaků. Heslo je zkontrolováno vůči databázi úniku.</span>
              </div>
              <label className="flex items-start gap-2 text-sm" style={{ color: "#4a5f6a" }}>
                <input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
                Souhlasím se zpracováním osobních údajů a obchodními podmínkami.
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>IČO</label>
                <div className="flex gap-2">
                  <input className={inputClass} style={inputStyle} value={ico} onChange={e => setIco(e.target.value)} placeholder="12345678" />
                  <button type="button" onClick={lookupIco} className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}>
                    Doplnit z ARES
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Název ordinace / praxe</label>
                <input required className={inputClass} style={inputStyle} value={practiceName} onChange={e => setPracticeName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Fakturační e-mail</label>
                <input type="email" className={inputClass} style={inputStyle} value={billingEmail} onChange={e => setBillingEmail(e.target.value)} placeholder={email} />
              </div>
              <div className="border-t pt-4 mt-2" style={{ borderColor: "var(--line)" }}>
                <p className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>První adresa pro sken</p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Popis adresy (volitelné)</label>
                    <input className={inputClass} style={inputStyle} value={locationLabel} onChange={e => setLocationLabel(e.target.value)} placeholder={practiceName || "Ordinace"} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Ulice a č.p.</label>
                    <input className={inputClass} style={inputStyle} value={locationStreet} onChange={e => setLocationStreet(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Město</label>
                      <input className={inputClass} style={inputStyle} value={locationCity} onChange={e => setLocationCity(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>PSČ</label>
                      <input className={inputClass} style={inputStyle} value={locationZip} onChange={e => setLocationZip(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Přístupová poznámka pro technika</label>
                    <textarea className={inputClass} style={inputStyle} rows={2} value={locationAccessNote} onChange={e => setLocationAccessNote(e.target.value)} placeholder="2. patro, výtah, parkování ve dvoře" />
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#fdf0ee", color: "var(--status-cancelled)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 mt-2">
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)} className="flex-1 border text-sm font-medium py-2.5 rounded-lg" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                Zpět
              </button>
            )}
            <button type="submit" disabled={loading} className="flex-1 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60" style={{ background: "var(--cyan)" }}>
              {loading ? "…" : step === 1 ? "Pokračovat" : "Vytvořit účet"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-xs text-center" style={{ color: "#6b7f8a" }}>
          Máte účet?{" "}
          <Link href="/prihlasit" style={{ color: "var(--cyan-deep)" }}>Přihlásit se</Link>
        </p>
      </div>
    </main>
  );
}
