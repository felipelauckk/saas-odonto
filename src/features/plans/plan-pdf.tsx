import "server-only";

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatIsoDate } from "@/lib/dates";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/format";
import { splitInstallments } from "@/lib/installments";

import { faceLabel, type Face } from "@/features/clinical/odontogram";

import type { PlanDetail } from "./queries";
import { PDF_COLORS, registerPdfFonts } from "@/lib/pdf/fonts";

type Letterhead = {
  name: string;
  legal_name: string | null;
  document_cnpj_cpf: string | null;
  phone: string | null;
  email: string | null;
  logo: { data: Buffer; format: "png" | "jpg" } | null;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Montserrat", color: PDF_COLORS.text },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  logo: { width: 64, height: 64, objectFit: "contain", marginRight: 12 },
  clinicName: { fontSize: 14, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand },
  muted: { color: PDF_COLORS.muted },
  title: { fontSize: 16, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand, marginBottom: 4 },
  section: { marginBottom: 16 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 6 },
  th: { fontFamily: "Montserrat-Bold", color: PDF_COLORS.muted },
  colDesc: { flex: 1 },
  colTooth: { width: 120 },
  colStatus: { width: 70 },
  colPrice: { width: 80, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 220, marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  bold: { fontFamily: "Montserrat-Bold" },
  footer: { position: "absolute", bottom: 40, left: 40, right: 40 },
  signature: { marginTop: 48, flexDirection: "row", justifyContent: "space-between" },
  signLine: { width: 220, borderTopWidth: 0.5, borderTopColor: PDF_COLORS.text, paddingTop: 4, textAlign: "center" },
});

function toothText(tooth: number | null, faces: string[]) {
  if (!tooth) return "—";
  return faces.length ? `${tooth} (${faces.map((f) => faceLabel(f as Face, tooth)).join(", ")})` : String(tooth);
}

export async function renderPlanPdf({ plan, items, receivables }: PlanDetail, clinic: Letterhead): Promise<Buffer> {
  registerPdfFonts();
  const decided = !["draft", "presented"].includes(plan.status);
  const shownItems = decided ? items.filter((i) => i.status !== "rejected") : items;
  const subtotal = shownItems.reduce((s, i) => s + i.price_cents, 0);
  const total = subtotal - (decided ? plan.discount_cents : 0);
  const schedule = receivables.length
    ? receivables.map((r) => ({ number: r.installment_number, amountCents: r.amount_cents, dueDate: r.due_date }))
    : plan.first_due_date
      ? splitInstallments(total, plan.installments, plan.first_due_date)
      : [];
  const contact = [clinic.phone ? formatPhone(clinic.phone) : null, clinic.email].filter(Boolean).join(" · ");

  const doc = (
    <Document title={`Orçamento - ${plan.patients?.full_name ?? ""}`} author={clinic.name} language="pt-BR">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
            {clinic.logo ? <Image style={styles.logo} src={{ data: clinic.logo.data, format: clinic.logo.format }} /> : null}
            <View>
              <Text style={styles.clinicName}>{clinic.name}</Text>
              {clinic.legal_name ? <Text style={styles.muted}>{clinic.legal_name}</Text> : null}
              {clinic.document_cnpj_cpf ? <Text style={styles.muted}>{formatCpfCnpj(clinic.document_cnpj_cpf)}</Text> : null}
              {contact ? <Text style={styles.muted}>{contact}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>Orçamento</Text>
            <Text style={styles.muted}>Emitido em {formatDate(new Date())}</Text>
            {plan.valid_until ? <Text style={styles.muted}>Válido até {formatIsoDate(plan.valid_until)}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text>
            <Text style={styles.bold}>Paciente: </Text>
            {plan.patients?.full_name}
            {plan.patients?.cpf ? ` · CPF ${formatCpfCnpj(plan.patients.cpf)}` : ""}
          </Text>
          <Text>
            <Text style={styles.bold}>Profissional: </Text>
            {plan.professionals?.name}
            {plan.professionals?.cro ? ` · CRO ${plan.professionals.cro}` : ""}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={[styles.th, styles.colDesc]}>Procedimento</Text>
            <Text style={[styles.th, styles.colTooth]}>Dente / faces</Text>
            <Text style={[styles.th, styles.colPrice]}>Valor</Text>
          </View>
          {shownItems.map((item) => (
            <View key={item.id} style={styles.row} wrap={false}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colTooth}>{toothText(item.tooth, item.faces)}</Text>
              <Text style={styles.colPrice}>{formatCurrency(item.price_cents)}</Text>
            </View>
          ))}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{formatCurrency(subtotal)}</Text>
            </View>
            {decided && plan.discount_cents ? (
              <View style={styles.totalRow}>
                <Text>Desconto</Text>
                <Text>- {formatCurrency(plan.discount_cents)}</Text>
              </View>
            ) : null}
            <View style={[styles.totalRow, { borderTopWidth: 0.5, borderTopColor: PDF_COLORS.text, marginTop: 2, paddingTop: 4 }]}>
              <Text style={styles.bold}>Total</Text>
              <Text style={styles.bold}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>

        {schedule.length ? (
          <View style={styles.section} wrap={false}>
            <Text style={[styles.bold, { marginBottom: 4 }]}>
              Pagamento{plan.payment_methods?.name ? ` (${plan.payment_methods.name})` : ""}
            </Text>
            {schedule.map((p) => (
              <Text key={p.number}>
                {schedule.length > 1 ? `${p.number}ª parcela` : "À vista"} — {formatCurrency(p.amountCents)} — vencimento {formatIsoDate(p.dueDate)}
              </Text>
            ))}
          </View>
        ) : null}

        {plan.notes ? (
          <View style={styles.section}>
            <Text style={styles.bold}>Observações</Text>
            <Text>{plan.notes}</Text>
          </View>
        ) : null}

        <View style={styles.signature} wrap={false}>
          <Text style={styles.signLine}>{plan.patients?.full_name}</Text>
          <Text style={styles.signLine}>{plan.professionals?.name}</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
