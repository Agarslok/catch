import type { Metadata } from "next";
import { Comfortaa, Nunito_Sans } from "next/font/google";
import "./globals.css";

const display = Comfortaa({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Capital Humano Live · Catch Consulting",
  description: "Presentación interactiva en tiempo real",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
