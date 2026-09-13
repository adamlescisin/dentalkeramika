"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/dk/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Přihlášení se nezdařilo.");
        return;
      }
      router.push("/admin");
    } catch {
      setError("Chyba sítě.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <Link href="/" className="font-bold text-xl" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
            DentálníKeramika
          </Link>
          <p className="text-sm mt-1" style={{ color: "#6b7f8a" }}>Administrace</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border p-6 flex flex-col gap-4" style={{ borderColor: "var(--line)" }}>
          <h1 className="text-lg font-bold" style={{ color: "var(--ink)" }}>Přihlásit se</h1>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "#fff5f5", color: "#7a1a1a" }}>{error}</div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "#6b7f8a" }}>E-mail</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "#6b7f8a" }}>Heslo</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--cyan)" }}
          >
            {loading ? "Přihlašuji…" : "Přihlásit se"}
          </button>
        </form>
      </div>
    </main>
  );
}
