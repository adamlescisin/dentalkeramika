import type { Metadata } from "next";
import { Archivo } from "next/font/google";
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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
