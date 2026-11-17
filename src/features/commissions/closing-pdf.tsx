import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatIsoDate } from "@/lib/dates";
import { formatCurrency, formatDateTime } from "@/lib/format";

import type { Line } from "./calc";
import { PDF_COLORS, registerPdfFonts } from "@/lib/pdf/fonts";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 8.5, fontFamily: "Montserrat", color: PDF_COLORS.text },
  title: { fontSize: 14, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand },
  muted: { color: PDF_COLORS.muted },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 3 },
  th: { fontFamily: "Montserrat-Bold", color: PDF_COLORS.muted },
  c1: { width: 50 }, c2: { width: 110 }, c3: { flex: 1 }, num: { width: 62, textAlign: "right" }, rule: { width: 52, textAlign: "right" },
});

export async function renderClosingPdf(input: { clinicName: string; professionalName: string; month: string; base: "received" | "executed"; lines: Line[]; totals: { gross: number; base: number; commission: number } }) {
  registerPdfFonts();
  const monthLabel = new Date(`${input.month}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const doc = (
    <Document title={`Comissão ${input.professionalName} ${input.month}`} author={input.clinicName} language="pt-BR">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Demonstrativo de comissão — {monthLabel}</Text>
        <Text style={[s.muted, { marginBottom: 12 }]}>
          {input.clinicName} · {input.professionalName} · base: {input.base === "received" ? "valores recebidos" : "procedimentos executados"} · fechado em {formatDateTime(new Date())}
        </Text>
        <View style={s.row}>
          <Text style={[s.th, s.c1]}>Data</Text>
          <Text style={[s.th, s.c2]}>Paciente</Text>
          <Text style={[s.th, s.c3]}>Descrição</Text>
          <Text style={[s.th, s.num]}>Valor</Text>
          <Text style={[s.th, s.num]}>Taxa</Text>
          <Text style={[s.th, s.num]}>Laboratório</Text>
          <Text style={[s.th, s.num]}>Base</Text>
          <Text style={[s.th, s.rule]}>Regra</Text>
          <Text style={[s.th, s.num]}>Comissão</Text>
        </View>
        {input.lines.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.c1}>{formatIsoDate(l.date)}</Text>
            <Text style={s.c2}>{l.patientName}</Text>
            <Text style={s.c3}>{l.description}</Text>
            <Text style={s.num}>{formatCurrency(l.grossCents)}</Text>
            <Text style={s.num}>{l.feeCents ? formatCurrency(l.feeCents) : "—"}</Text>
            <Text style={s.num}>{l.labCents ? formatCurrency(l.labCents) : "—"}</Text>
            <Text style={s.num}>{formatCurrency(l.baseCents)}</Text>
            <Text style={s.rule}>{l.rule}</Text>
            <Text style={s.num}>{formatCurrency(l.commissionCents)}</Text>
          </View>
        ))}
        <View style={[s.row, { borderBottomWidth: 0, marginTop: 6 }]}>
          <Text style={[s.th, s.c3]}>Total</Text>
          <Text style={[s.th, s.num]}>{formatCurrency(input.totals.gross)}</Text>
          <Text style={[s.th, s.num]}>{formatCurrency(input.totals.base)}</Text>
          <Text style={[s.th, s.num]}>{formatCurrency(input.totals.commission)}</Text>
        </View>
        <Text style={{ marginTop: 40 }}>______________________________          ______________________________</Text>
        <Text>{input.clinicName}                                                              {input.professionalName}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
