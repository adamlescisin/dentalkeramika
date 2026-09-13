"use client";

import { useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "password" | "magic" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("password");
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("verified") === "1") {
      setBanner("E-mail ověřen. Nyní se můžete přihlásit.");
    } else if (p.get("banner") === "password_reset") {
      setBanner("Heslo bylo změněno. Přihlaste se novým heslem.");
    } else if (p.get("error") === "link_expired" || p.get("error") === "invalid_link") {
      setBanner("Odkaz vypršel nebo byl již použit.");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (tab === "password") {
        const res = await fetch("/api/dk/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = res.ok ? await res.json().catch(() => ({})) : await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Přihlášení se nezdařilo.");
        } else {
          router.replace("/portal/dashboard");
        }
      } else if (tab === "magic") {
        await fetch("/api/dk/v1/auth/magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setSuccess("Pokud je e-mail registrován, přijde vám odkaz do 1 minuty.");
      } else {
        await fetch("/api/dk/v1/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setSuccess("Pokud je e-mail registrován, přijde vám odkaz pro obnovu hesla.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--porcelain)" }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8"
        style={{ borderColor: "var(--line)" }}
      >
        <h1
          className="text-2xl font-bold mb-6"
          style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}
        >
          Přihlásit se
        </h1>

        {banner && (
          <div className="rounded-xl p-3 border mb-4 text-sm" style={{ background: "#f0faf5", borderColor: "#52c87a", color: "#1a6b3c" }}>
            {banner}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: "var(--porcelain)" }}>
          {(["password", "magic", "reset"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setSuccess(null); }}
              className="flex-1 text-xs font-medium py-2 rounded-md transition-colors"
              style={{
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "var(--ink)" : "#6b7f8a",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}
            >
              {t === "password" ? "Heslo" : t === "magic" ? "Odkaz" : "Obnova"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "var(--line)",
                color: "var(--ink)",
              }}
              placeholder="vas@email.cz"
            />
          </div>

          {tab === "password" && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                Heslo
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>
          )}

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#fdf0ee", color: "var(--status-cancelled)" }}>
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#edf7f3", color: "var(--status-confirmed)" }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="font-semibold py-2.5 rounded-lg text-sm text-white disabled:opacity-60"
            style={{ background: "var(--cyan)" }}
          >
            {loading
              ? "…"
              : tab === "password"
              ? "Přihlásit se"
              : tab === "magic"
              ? "Odeslat odkaz"
              : "Odeslat odkaz pro obnovu"}
          </button>
        </form>

        <p className="mt-6 text-xs text-center" style={{ color: "#6b7f8a" }}>
          Nemáte účet?{" "}
          <Link href="/registrace" style={{ color: "var(--cyan-deep)" }}>
            Zaregistrujte se
          </Link>
        </p>
      </div>
    </main>
  );
}
