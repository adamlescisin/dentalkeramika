import Link from "next/link";
import Image from "next/image";

export default function LoggedOutPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--porcelain)" }}
    >
      <Link href="/" className="mb-8 flex items-center gap-2" style={{ textDecoration: "none" }}>
        <Image src="/logo.webp" alt="DentálníKeramika" height={36} width={180} style={{ objectFit: "contain" }} />
      </Link>

      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center"
        style={{ borderColor: "var(--line)" }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--porcelain)" }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M9 11l2 2 4-4" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="11" cy="11" r="9" stroke="var(--cyan)" strokeWidth="2"/>
          </svg>
        </div>

        <h1 className="text-xl font-bold mb-3" style={{ color: "var(--ink)" }}>
          Byli jste odhlášeni
        </h1>
        <p className="text-sm mb-6" style={{ color: "#4a5f6a", lineHeight: 1.6 }}>
          Byli jste úspěšně odhlášeni z portálu Dental&nbsp;Keramika.
          V případě potřeby se můžete znovu přihlásit.
        </p>

        <Link
          href="/prihlasit"
          className="block w-full text-white text-sm font-semibold py-2.5 rounded-lg text-center"
          style={{ background: "var(--cyan)", textDecoration: "none" }}
        >
          Přihlásit se
        </Link>
      </div>
    </main>
  );
}
