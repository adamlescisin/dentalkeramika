"use client";

import { useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PasswordResetPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("token");
    if (!t) setError("Odkaz pro obnovu hesla je neplatný.");
    else setToken(t);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("Heslo musí mít alespoň 10 znaků.");
      return;
    }
    if (password !== confirm) {
      setError("Hesla se neshodují.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/dk/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type: "reset", newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Obnova hesla se nezdařila.");
      } else {
        router.replace("/prihlasit?banner=password_reset");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--porcelain)" }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: "var(--line)" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          Nové heslo
        </h1>
        <p className="text-sm mb-6" style={{ color: "#6b7f8a" }}>
          Zadejte nové heslo pro svůj účet.
        </p>

        {error && !token ? (
          <div className="rounded-xl p-4 border text-sm mb-4" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
            {error}{" "}
            <Link href="/prihlasit" style={{ color: "var(--cyan-deep)", textDecoration: "underline" }}>
              Zpět na přihlášení
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Nové heslo</label>
              <input
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                placeholder="min. 10 znaků"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Potvrdit heslo</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#fdf0ee", color: "var(--status-cancelled)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !token}
              className="font-semibold py-2.5 rounded-lg text-sm text-white disabled:opacity-60"
              style={{ background: "var(--cyan)" }}
            >
              {loading ? "Ukládám…" : "Nastavit heslo"}
            </button>
          </form>
        )}

        <p className="mt-6 text-xs text-center" style={{ color: "#6b7f8a" }}>
          <Link href="/prihlasit" style={{ color: "var(--cyan-deep)" }}>Zpět na přihlášení</Link>
        </p>
      </div>
    </main>
  );
}
