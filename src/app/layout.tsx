import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DentálníKeramika",
    template: "%s — DentálníKeramika",
  },
  description: "Dentální laboratoř — rezervace skenů a celodenního pronájmu technika.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className={archivo.variable}>
      <body className="min-h-screen">
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-Z5L6VKS4XQ"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-Z5L6VKS4XQ');
          `}
        </Script>
      </body>
    </html>
  );
}
