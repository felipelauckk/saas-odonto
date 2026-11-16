import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";

import { BRAND } from "@/lib/brand";

import "./globals.css";

/** Montserrat variável (100–900): Black nos títulos, pesos finos no resto. */
const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  description: "Gestão para clínicas odontológicas",
};

export const viewport: Viewport = {
  themeColor: "#0C3640",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">{children}</body>
    </html>
  );
}
