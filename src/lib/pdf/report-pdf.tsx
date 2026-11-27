import "server-only";

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";

import { PDF_COLORS, registerPdfFonts } from "./fonts";

export type PdfLetterhead = {
  name: string;
  legal_name: string | null;
  document_cnpj_cpf: string | null;
  phone: string | null;
  logo: { data: Buffer; format: "png" | "jpg" } | null;
};

/** Tabela: colunas com largura relativa (flex). */
export type PdfTable = { title?: string; columns: { label: string; flex?: number }[]; rows: string[][]; empty?: string };
/** Lista de campos "rótulo: valor" em duas colunas. */
export type PdfFields = { title: string; fields: [string, string | null | undefined][] };
export type PdfBlock = ({ kind: "table" } & PdfTable) | ({ kind: "fields" } & PdfFields) | { kind: "image"; title?: string; data: Buffer; height: number };

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, fontFamily: "Montserrat", color: PDF_COLORS.text, lineHeight: 1.35 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.border, paddingBottom: 10 },
  logo: { width: 40, height: 40, objectFit: "contain", marginRight: 10 },
  clinic: { fontSize: 12, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand },
  muted: { color: PDF_COLORS.muted, fontSize: 8.5 },
  title: { fontSize: 15, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand, marginBottom: 2 },
  subtitle: { color: PDF_COLORS.muted, marginBottom: 12 },
  h2: { fontSize: 10.5, fontFamily: "Montserrat-Bold", marginTop: 12, marginBottom: 5 },
  th: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: PDF_COLORS.brand, paddingBottom: 3, marginBottom: 2 },
  thText: { fontFamily: "Montserrat-Bold", fontSize: 8, color: PDF_COLORS.muted, paddingRight: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.border, paddingVertical: 3.5 },
  td: { paddingRight: 6 },
  fields: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", flexDirection: "row", marginBottom: 3, paddingRight: 8 },
  label: { width: 105, color: PDF_COLORS.muted },
  value: { flex: 1 },
  footer: { position: "absolute", bottom: 22, left: 36, right: 36, fontSize: 7.5, color: PDF_COLORS.faint, flexDirection: "row", justifyContent: "space-between" },
});

/**
 * PDF de lista no padrão dos PDFs da clínica: papel timbrado, título, blocos de
 * campos ou tabelas e rodapé com data de emissão e página.
 */
export async function renderReportPdf(opts: {
  letterhead: PdfLetterhead;
  title: string;
  subtitle?: string;
  blocks: PdfBlock[];
  landscape?: boolean;
}): Promise<Buffer> {
  registerPdfFonts();
  const { letterhead: c } = opts;
  const doc = (
    <Document title={opts.title} author={c.name} language="pt-BR">
      <Page size="A4" orientation={opts.landscape ? "landscape" : "portrait"} style={s.page}>
        <View style={s.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          {c.logo ? <Image style={s.logo} src={{ data: c.logo.data, format: c.logo.format }} /> : null}
          <View>
            <Text style={s.clinic}>{c.name}</Text>
            <Text style={s.muted}>
              {[c.legal_name, c.document_cnpj_cpf ? formatCpfCnpj(c.document_cnpj_cpf) : null, c.phone ? formatPhone(c.phone) : null].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
        <Text style={s.title}>{opts.title}</Text>
        {opts.subtitle ? <Text style={s.subtitle}>{opts.subtitle}</Text> : <View style={{ marginBottom: 8 }} />}
        {opts.blocks.map((b, i) => {
          if (b.kind === "fields") {
            return (
              <View key={i} wrap={false}>
                <Text style={s.h2}>{b.title}</Text>
                <View style={s.fields}>
                  {b.fields.map(([label, value]) => (
                    <View key={label} style={s.field}>
                      <Text style={s.label}>{label}</Text>
                      <Text style={s.value}>{value || "—"}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          }
          if (b.kind === "image") {
            return (
              <View key={i} wrap={false}>
                {b.title ? <Text style={s.h2}>{b.title}</Text> : null}
                {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
                <Image src={{ data: b.data, format: "png" }} style={{ height: b.height, objectFit: "contain" }} />
              </View>
            );
          }
          return (
            <View key={i}>
              {b.title ? <Text style={s.h2}>{b.title}</Text> : null}
              <View style={s.th} fixed={false}>
                {b.columns.map((col) => (
                  <Text key={col.label} style={[s.thText, { flex: col.flex ?? 1 }]}>
                    {col.label}
                  </Text>
                ))}
              </View>
              {b.rows.length ? (
                b.rows.map((row, r) => (
                  <View key={r} style={s.tr} wrap={false}>
                    {row.map((cell, k) => (
                      <Text key={k} style={[s.td, { flex: b.columns[k]?.flex ?? 1 }]}>
                        {cell || "—"}
                      </Text>
                    ))}
                  </View>
                ))
              ) : (
                <Text style={[s.muted, { paddingVertical: 6 }]}>{b.empty ?? "Nada para mostrar."}</Text>
              )}
            </View>
          );
        })}
        <View style={s.footer} fixed>
          <Text>Emitido em {formatDateTime(new Date().toISOString())}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

/** Resposta HTTP de um PDF. */
export function pdfResponse(pdf: Buffer, filename: string, inline = true): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
