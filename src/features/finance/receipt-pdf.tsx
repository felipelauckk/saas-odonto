import "server-only";

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { centsToWords } from "@/lib/extenso";
import { formatCurrency, formatDate } from "@/lib/format";
import { PDF_COLORS, registerPdfFonts } from "@/lib/pdf/fonts";

type Letterhead = {
  name: string;
  legal_name: string | null;
  document_cnpj_cpf: string | null;
  phone: string | null;
  email: string | null;
  logo: { data: Buffer; format: "png" | "jpg" } | null;
};

type Receipt = {
  id: string;
  description: string;
  paid_at: string;
  paid_amount_cents: number;
  patients: { full_name: string; cpf: string | null } | null;
  payment_methods: { name: string } | null;
};

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Montserrat", color: PDF_COLORS.text },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 32 },
  logo: { width: 56, height: 56, objectFit: "contain", marginRight: 12 },
  clinic: { fontSize: 14, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand },
  muted: { color: PDF_COLORS.muted, fontSize: 10 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 },
  title: { fontSize: 20, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand, letterSpacing: 2 },
  amount: { fontSize: 16, fontFamily: "Montserrat-Bold", borderWidth: 1, borderColor: PDF_COLORS.text, padding: 8 },
  body: { lineHeight: 1.6, marginBottom: 32 },
  bold: { fontFamily: "Montserrat-Bold" },
  signature: { marginTop: 56, alignSelf: "center", width: 260, borderTopWidth: 0.5, borderTopColor: PDF_COLORS.text, paddingTop: 4, textAlign: "center" },
  code: { position: "absolute", bottom: 32, left: 48, color: PDF_COLORS.faint, fontSize: 8 },
});

export async function renderReceiptPdf(receipt: Receipt, clinic: Letterhead): Promise<Buffer> {
  registerPdfFonts();
  const amount = receipt.paid_amount_cents;
  const doc = (
    <Document title={`Recibo - ${receipt.patients?.full_name ?? ""}`} author={clinic.name} language="pt-BR">
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          {clinic.logo ? <Image style={styles.logo} src={{ data: clinic.logo.data, format: clinic.logo.format }} /> : null}
          <View>
            <Text style={styles.clinic}>{clinic.name}</Text>
            <Text style={styles.muted}>
              {[clinic.legal_name, clinic.document_cnpj_cpf ? formatCpfCnpj(clinic.document_cnpj_cpf) : null, clinic.phone ? formatPhone(clinic.phone) : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>RECIBO</Text>
          <Text style={styles.amount}>{formatCurrency(amount)}</Text>
        </View>
        <Text style={styles.body}>
          Recebemos de <Text style={styles.bold}>{receipt.patients?.full_name}</Text>
          {receipt.patients?.cpf ? `, CPF ${formatCpfCnpj(receipt.patients.cpf)},` : ""} a quantia de{" "}
          <Text style={styles.bold}>
            {formatCurrency(amount)} ({centsToWords(amount)})
          </Text>
          , referente a {receipt.description}
          {receipt.payment_methods?.name ? `, pago em ${receipt.payment_methods.name.toLowerCase()}` : ""}, em {formatDate(receipt.paid_at)}.
        </Text>
        <Text style={styles.signature}>{clinic.legal_name ?? clinic.name}</Text>
        <Text style={styles.code}>Recibo {receipt.id.slice(0, 8).toUpperCase()}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
