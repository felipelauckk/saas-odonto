import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type Evidence = {
  documentTitle: string;
  documentCode: string;
  clinicName: string;
  signerName: string;
  signedAt: string; // texto já formatado (São Paulo)
  ip: string;
  userAgent: string;
  originalSha256: string;
  signaturePng: Uint8Array;
};

/** Fonte padrão do PDF só tem caracteres latinos (WinAnsi): troca o que não couber. */
function safe(text: string) {
  return text.replace(/[^\x20-\x7E -ÿ—–’“”•]/g, "?");
}

function wrap(text: string, max: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Acrescenta a página de evidências ao PDF original. As páginas originais não
 * são regeradas: continuam idênticas, e o hash delas fica registrado nesta página.
 */
export async function appendEvidencePage(original: Uint8Array, evidence: Evidence): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const left = 56;

  const write = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
    page.drawText(safe(text), { x: left, y, size: opts.size ?? 10, font: opts.bold ? bold : font, color: rgb(...(opts.color ?? [0.07, 0.09, 0.15])) });
    y -= (opts.size ?? 10) + 6;
  };

  write("Página de evidências da assinatura eletrônica", { size: 15, bold: true });
  y -= 6;
  write(`${evidence.documentTitle} · código ${evidence.documentCode}`, { color: [0.42, 0.45, 0.5] });
  write(evidence.clinicName, { color: [0.42, 0.45, 0.5] });
  y -= 10;

  const field = (label: string, value: string) => {
    write(label, { bold: true, size: 9 });
    for (const line of wrap(value, 95)) write(line, { size: 9 });
    y -= 4;
  };
  field("Assinado por (nome digitado)", evidence.signerName);
  field("Data e hora (horário de Brasília)", evidence.signedAt);
  field("Endereço IP", evidence.ip);
  field("Navegador", evidence.userAgent);
  field("Hash SHA-256 do arquivo original, antes desta página", evidence.originalSha256);
  field(
    "Declaração",
    "O signatário marcou a caixa de aceite, digitou o próprio nome e desenhou a assinatura abaixo, por meio de link pessoal, de uso único e com prazo, enviado pela clínica.",
  );

  write("Assinatura desenhada", { bold: true, size: 9 });
  const image = await pdf.embedPng(evidence.signaturePng);
  const width = 260;
  const height = Math.min((image.height / image.width) * width, 120);
  page.drawRectangle({ x: left, y: y - height - 8, width: width + 16, height: height + 16, borderColor: rgb(0.8, 0.82, 0.85), borderWidth: 0.5 });
  page.drawImage(image, { x: left + 8, y: y - height, width, height });
  y -= height + 40;

  for (const line of wrap(
    "Integridade: o hash SHA-256 deste arquivo assinado fica registrado no sistema da clínica. A opção Verificar documento confere um arquivo com o registro; qualquer alteração, por menor que seja, muda o hash.",
    110,
  ))
    write(line, { size: 8, color: [0.42, 0.45, 0.5] });

  return pdf.save();
}
