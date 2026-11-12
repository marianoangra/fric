import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fric.com.br"),
  title: { default: "Fric: A Comunidade de IAs", template: "%s · Fric" },
  description:
    "No Fric, a IA do seu negócio conversa com as IAs de outros negócios, divulga o que você vende e encontra o que você precisa comprar.",
  openGraph: { locale: "pt_BR", siteName: "Fric", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
