import path from "node:path";

import { Font } from "@react-pdf/renderer";

/**
 * Montserrat nos PDFs (mesma tipografia da tela). Os arquivos ficam em
 * src/lib/pdf/fonts (licença SIL OFL, ver OFL.txt) e entram no pacote da
 * Vercel por `outputFileTracingIncludes` no next.config.ts.
 */
let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "src/lib/pdf/fonts");
  Font.register({ family: "Montserrat", src: path.join(dir, "Montserrat-Regular.ttf") });
  Font.register({ family: "Montserrat-SemiBold", src: path.join(dir, "Montserrat-SemiBold.ttf") });
  Font.register({ family: "Montserrat-Bold", src: path.join(dir, "Montserrat-Bold.ttf") });
  Font.register({ family: "Montserrat-Black", src: path.join(dir, "Montserrat-Black.ttf") });
  // Sem hifenização automática (a padrão é a do inglês e quebra palavras em português).
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

/** Cores dos PDFs: as mesmas dos tokens da tela (globals.css), em hexadecimal. */
export const PDF_COLORS = {
  text: "#14181f",
  muted: "#4a515c",
  faint: "#8a9099",
  border: "#e8e6e1",
  brand: "#0c3640",
  primary: "#17707f",
} as const;
