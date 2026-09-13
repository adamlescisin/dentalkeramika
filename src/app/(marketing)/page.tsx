import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--porcelain)" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--line)", background: "#fff" }}
      >
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}
        >
          DentálníKeramika
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/prihlasit"
            className="text-sm font-medium"
            style={{ color: "var(--cyan-deep)" }}
          >
            Přihlásit se
          </Link>
          <Link
            href="/rezervace"
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
            style={{ background: "var(--cyan)" }}
          >
            Rezervovat termín
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <h1
          className="text-4xl md:text-5xl font-bold mb-4"
          style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112", letterSpacing: "-0.025em" }}
        >
          Intraorální sken<br />přímo ve vaší ordinaci
        </h1>
        <p className="text-lg mb-8 max-w-xl" style={{ color: "#4a5f6a" }}>
          Objednejte technika online. Přijede k vám, naskenuje, odjede — vy
          se staráte o pacienta, my o keramiku.
        </p>
        <Link
          href="/rezervace"
          className="inline-block text-base font-semibold px-6 py-3 rounded-lg text-white"
          style={{ background: "var(--cyan)" }}
        >
          Rezervovat termín →
        </Link>
      </section>

      {/* Services asymmetric list */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2
          className="text-2xl font-bold mb-8"
          style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}
        >
          Naše služby
        </h2>
        <div className="divide-y" style={{ borderColor: "var(--line)" }}>
          {[
            {
              code: "a",
              name: "Sken — Praha",
              desc: "Technik přijede do vaší ordinace v Praze, provede intraorální sken a odjede. Celkový blok v diáři: 2 h 30 min.",
              online: true,
            },
            {
              code: "b",
              name: "Sken — do 30 km od Prahy",
              desc: "Střední Čechy a prstencové okolí Prahy. Celkový blok: 3 hodiny.",
              online: true,
            },
            {
              code: "c",
              name: "Sken — do 100 km od Prahy",
              desc: "Celé Čechy a blízká Morava. Celkový blok: 4 hodiny.",
              online: true,
            },
            {
              code: "d",
              name: "Celodenní pronájem s technikem",
              desc: "Technik u vás celý den (8 h). Vhodné pro větší praxe nebo hromadné skenování. Rezervace vyžaduje potvrzení.",
              online: false,
            },
          ].map((s) => (
            <div key={s.code} className="py-6 grid md:grid-cols-[1fr_2fr_auto] gap-4 items-start">
              <div>
                <span
                  className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded"
                  style={{ background: "var(--line)", color: "var(--ink)" }}
                >
                  {s.code.toUpperCase()}
                </span>
                <h3 className="text-lg font-semibold mt-2" style={{ color: "var(--ink)" }}>
                  {s.name}
                </h3>
              </div>
              <p className="text-sm" style={{ color: "#4a5f6a" }}>{s.desc}</p>
              <div className="text-sm font-medium" style={{ color: s.online ? "var(--status-confirmed)" : "var(--status-pending)" }}>
                {s.online ? "Rezervace online" : "Rezervace na vyžádání"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4-step collaboration flow */}
      <section
        className="py-16 px-6"
        style={{ background: "var(--ink)", color: "#fff" }}
      >
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-2xl font-bold mb-10"
            style={{ fontVariationSettings: "'wdth' 112" }}
          >
            Jak to funguje
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { n: "1", title: "Vyberte termín", text: "Zvolte kategorii služby a datum v online kalendáři." },
              { n: "2", title: "Potvrďte rezervaci", text: "Zadejte adresu ordinace a kontakt pro ten den." },
              { n: "3", title: "Přijede technik", text: "Ve sjednaný čas přijede, naskenuje a odjede." },
              { n: "4", title: "Dostanete výsledky", text: "Hotové práce doručíme nebo stáhnete z portálu." },
            ].map((step) => (
              <div key={step.n} className="flex flex-col gap-2">
                <span
                  className="text-4xl font-bold"
                  style={{ color: "var(--cyan)", fontVariationSettings: "'wdth' 112" }}
                >
                  {step.n}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-sm opacity-75">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t px-6 py-8 text-sm"
        style={{ borderColor: "var(--line)", color: "#4a5f6a" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-4 justify-between">
          <span>© 2026 DentálníKeramika</span>
          <div className="flex gap-6">
            <Link href="/prihlasit">Přihlásit se</Link>
            <Link href="/registrace">Registrace</Link>
            <Link href="mailto:info@dentalkeramika.cz">Kontakt</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
