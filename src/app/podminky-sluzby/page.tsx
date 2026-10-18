import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Podmínky služby",
  description:
    "Podmínky používání rezervačního systému a zásady ochrany osobních údajů DentálníKeramika.",
};

const UPDATED = "18. 10. 2026";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-6">
      <h3 className="text-lg font-bold mb-2" style={{ color: "var(--ink)" }}>
        {title}
      </h3>
      <div className="flex flex-col gap-2 text-sm leading-relaxed" style={{ color: "#3a4f5a" }}>
        {children}
      </div>
    </section>
  );
}

export default function PodminkySluzbyPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--porcelain)" }}>
      <nav className="border-b" style={{ borderColor: "var(--line)", background: "#fff" }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="DentálníKeramika" style={{ height: 70, width: "auto", display: "block" }} />
          </Link>
          <Link href="/" className="text-sm font-medium" style={{ color: "var(--cyan-deep)" }}>
            ← Zpět na úvod
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--ink)" }}>
          Podmínky služby
        </h1>
        <p className="text-sm mb-8" style={{ color: "#6b7f8a" }}>
          Poslední aktualizace: {UPDATED}
        </p>

        <div className="bg-white border rounded-xl px-6 py-5 mb-10 text-sm" style={{ borderColor: "var(--line)" }}>
          <p className="font-semibold mb-2" style={{ color: "var(--ink)" }}>Obsah</p>
          <ol className="list-decimal pl-5 flex flex-col gap-1" style={{ color: "var(--cyan-deep)" }}>
            <li><a href="#provozovatel">Provozovatel</a></li>
            <li><a href="#sluzba">Předmět služby</a></li>
            <li><a href="#ucet">Uživatelský účet</a></li>
            <li><a href="#rezervace">Rezervace a storno podmínky</a></li>
            <li><a href="#odpovednost">Odpovědnost</a></li>
            <li><a href="#udaje">Zásady ochrany osobních údajů</a></li>
            <li><a href="#cookies">Cookies a analytika</a></li>
            <li><a href="#prava">Vaše práva</a></li>
            <li><a href="#zmeny">Změny podmínek</a></li>
          </ol>
        </div>

        <div className="bg-white border rounded-xl px-6 py-8" style={{ borderColor: "var(--line)" }}>
          <Section id="provozovatel" title="1. Provozovatel">
            <p>
              Provozovatelem rezervačního systému a správcem osobních údajů je společnost{" "}
              <strong>DentálníKeramika s.r.o.</strong>, IČO 22340157, se sídlem Hartigova 235/31, 130 00
              Praha 3 – Žižkov (dále jen „provozovatel“).
            </p>
            <p>
              Kontakt: <a href="mailto:info@dentalkeramika.cz" style={{ color: "var(--cyan-deep)" }}>info@dentalkeramika.cz</a>,
              tel. <a href="tel:+420733240842" style={{ color: "var(--cyan-deep)" }}>+420 733 240 842</a>.
            </p>
          </Section>

          <Section id="sluzba" title="2. Předmět služby">
            <p>
              Systém slouží stomatologickým ordinacím a jejich zaměstnancům k online rezervaci mobilního
              skenování a celodenního pronájmu technika s obsluhou. Služba je určena podnikatelům a
              zdravotnickým zařízením (B2B), nikoli spotřebitelům.
            </p>
            <p>
              Používáním systému nebo odesláním rezervace vyjadřujete souhlas s těmito podmínkami.
            </p>
          </Section>

          <Section id="ucet" title="3. Uživatelský účet">
            <p>
              Účet je veden na ordinaci; k jedné ordinaci může být přiřazeno více osob. Nové ordinace mohou
              podléhat schválení provozovatelem a do doby schválení mohou být rezervace potvrzovány ručně.
            </p>
            <p>
              Uživatel je povinen uvádět pravdivé údaje, chránit své přihlašovací údaje a bez zbytečného
              odkladu oznámit jejich zneužití. Za jednání osob přiřazených k účtu ordinace odpovídá
              ordinace.
            </p>
            <p>
              Provozovatel může účet zablokovat nebo zrušit v případě porušení podmínek nebo zneužití systému.
            </p>
          </Section>

          <Section id="rezervace" title="4. Rezervace a storno podmínky">
            <p>
              Dostupné termíny se zobrazují na základě pracovní doby technika, již existujících rezervací
              a kalendáře provozovatele. Rezervaci lze vytvořit s minimálním předstihem uvedeným v systému.
              Některé služby vyžadují schválení provozovatelem – v takovém případě je rezervace závazná až
              po potvrzení, o kterém budete informováni e-mailem.
            </p>
            <p>
              Termín lze přeložit nebo zrušit v klientském portálu{" "}
              <strong>nejpozději 24 hodin před začátkem návštěvy</strong>. Pozdější zrušení nebo nedostavení
              se k domluvenému termínu může být provozovatelem účtováno podle platného ceníku.
            </p>
            <p>
              Provozovatel si vyhrazuje právo termín z provozních důvodů (nemoc technika, dopravní situace,
              vyšší moc) změnit; v takovém případě nabídne náhradní termín nebo rezervaci zruší bez sankce.
            </p>
          </Section>

          <Section id="odpovednost" title="5. Odpovědnost">
            <p>
              Provozovatel vynakládá přiměřené úsilí na nepřetržitý a bezchybný provoz systému, nezaručuje
              však jeho dostupnost bez výpadků. Za škody vzniklé nedostupností systému provozovatel
              neodpovídá, pokud jejich vznik nezpůsobil úmyslně nebo hrubou nedbalostí.
            </p>
            <p>
              Cena a rozsah služeb se řídí platným ceníkem a individuální dohodou mezi provozovatelem
              a ordinací.
            </p>
          </Section>

          <Section id="udaje" title="6. Zásady ochrany osobních údajů">
            <p>
              Osobní údaje zpracováváme v souladu s nařízením Evropského parlamentu a Rady (EU) 2016/679
              (GDPR) a zákonem č. 110/2019 Sb., o zpracování osobních údajů.
            </p>
            <p className="font-semibold" style={{ color: "var(--ink)" }}>Jaké údaje zpracováváme</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>identifikační a kontaktní údaje: jméno, e-mail, telefon, název ordinace, IČO, adresa provozovny,</li>
              <li>údaje o rezervacích: termín, typ služby, poznámky, historie změn a zrušení,</li>
              <li>přihlašovací údaje: e-mail a heslo (ukládáme pouze jeho šifrovaný otisk), záznamy o přihlášení,</li>
              <li>technické údaje: IP adresa, typ prohlížeče a údaje z webové analytiky.</li>
            </ul>
            <p className="font-semibold" style={{ color: "var(--ink)" }}>Proč a na jakém základě</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>plnění smlouvy a jednání o ní – vytvoření a správa účtu a rezervací, komunikace o termínech,</li>
              <li>plnění právních povinností – účetní a daňové doklady,</li>
              <li>oprávněný zájem – zabezpečení systému, prevence zneužití, měření návštěvnosti.</li>
            </ul>
            <p>
              Údaje o pacientech do systému nezadávejte; poznámky k rezervaci by neměly obsahovat zdravotní
              údaje identifikující konkrétního pacienta.
            </p>
            <p className="font-semibold" style={{ color: "var(--ink)" }}>Komu údaje předáváme</p>
            <p>
              Údaje zpracovávají naši poskytovatelé služeb, kteří pro nás zajišťují provoz systému:
              hosting (Vercel), databáze (Neon, region EU – Frankfurt), odesílání e-mailů (Resend),
              kalendář (Google Calendar), úložiště (Cloudflare) a webová analytika (Google Analytics).
              Někteří z nich mohou údaje zpracovávat mimo EU na základě standardních smluvních doložek
              nebo jiných záruk podle GDPR.
            </p>
            <p className="font-semibold" style={{ color: "var(--ink)" }}>Jak dlouho údaje uchováváme</p>
            <p>
              Údaje o účtu uchováváme po dobu trvání obchodního vztahu a poté po dobu nezbytnou pro splnění
              právních povinností a ochranu právních nároků, nejdéle však 10 let. Údaje z analytiky
              uchováváme po dobu stanovenou jejím poskytovatelem.
            </p>
          </Section>

          <Section id="cookies" title="7. Cookies a analytika">
            <p>
              Web používá nezbytné cookies pro přihlášení a udržení relace. Dále používáme službu Google
              Analytics 4 k anonymizovanému měření návštěvnosti, která ukládá analytické cookies.
              Používání cookies můžete omezit v nastavení prohlížeče; omezení nezbytných cookies může
              znemožnit přihlášení.
            </p>
          </Section>

          <Section id="prava" title="8. Vaše práva">
            <p>
              Máte právo na přístup ke svým údajům, jejich opravu nebo výmaz, omezení zpracování,
              přenositelnost údajů a právo vznést námitku proti zpracování. Údaje o ordinaci můžete upravit
              přímo v portálu v sekci „Údaje ordinace“.
            </p>
            <p>
              Žádosti zasílejte na{" "}
              <a href="mailto:info@dentalkeramika.cz" style={{ color: "var(--cyan-deep)" }}>info@dentalkeramika.cz</a>.
              Pokud se domníváte, že jsou vaše údaje zpracovávány v rozporu s právními předpisy, máte právo
              podat stížnost u Úřadu pro ochranu osobních údajů (<a href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan-deep)" }}>uoou.gov.cz</a>).
            </p>
          </Section>

          <Section id="zmeny" title="9. Změny podmínek">
            <p>
              Provozovatel může tyto podmínky aktualizovat. Aktuální znění je vždy zveřejněno na této
              stránce s uvedením data poslední aktualizace. Tyto podmínky se řídí právním řádem České
              republiky.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
