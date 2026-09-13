"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

export default function ZrusitPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ serviceName: string; startsAt: string } | null>(null);

  useEffect(() => {
    fetch(`/api/dk/v1/reservations/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setInfo({ serviceName: d.data.service_name ?? "Rezervace", startsAt: d.data.starts_at });
      })
      .catch(() => {});
  }, [id]);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dk/v1/reservations/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Zrušení se nezdařilo.");
      } else {
        router.replace("/portal/rezervace?cancelled=1");
      }
    } finally {
      setLoading(false);
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague",
      weekday: "long", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--porcelain)" }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: "var(--line)" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          Zrušit rezervaci
        </h1>
        {info && (
          <p className="text-sm mb-6" style={{ color: "#6b7f8a" }}>
            {fmtDate(info.startsAt)}
          </p>
        )}

        <p className="text-sm mb-4" style={{ color: "#4a5f6a" }}>
          Tuto akci nelze vrátit zpět. Pokud chcete termín jen přeložit, použijte místo toho funkci přeložení.
        </p>

        <div className="flex flex-col gap-1 mb-6">
          <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Důvod zrušení <span style={{ color: "#6b7f8a" }}>(nepovinné)</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            placeholder="Např. nemoc, dovolená…"
          />
        </div>

        {error && (
          <div className="rounded-xl p-3 border text-sm mb-4" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href={`/portal/rezervace/${id}`}
            className="flex-1 text-sm font-medium py-2.5 rounded-lg border text-center"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            Zpět
          </Link>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 text-sm font-semibold py-2.5 rounded-lg text-white disabled:opacity-60"
            style={{ background: "var(--status-cancelled)" }}
          >
            {loading ? "Ruším…" : "Zrušit rezervaci"}
          </button>
        </div>
      </div>
    </main>
  );
}
