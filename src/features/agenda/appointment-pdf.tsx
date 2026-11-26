import "server-only";

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { PDF_COLORS, registerPdfFonts } from "@/lib/pdf/fonts";

type Letterhead = {
  name: string;
  legal_name: string | null;
  document_cnpj_cpf: string | null;
  phone: string | null;
  email: string | null;
  logo: { data: Buffer; format: "png" | "jpg" } | null;
};

export type AppointmentProof = {
  id: string;
  patientName: string;
  /** "quinta-feira, 26 de novembro de 2026" */
  dateText: string;
  timeText: string;
  professionalName: string;
  unitName: string;
  unitAddress: string | null;
  unitPhone: string | null;
  procedures: string[];
};

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Montserrat", color: PDF_COLORS.text },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  logo: { width: 56, height: 56, objectFit: "contain", marginRight: 12 },
  clinic: { fontSize: 14, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand },
  muted: { color: PDF_COLORS.muted, fontSize: 10 },
  title: { fontSize: 18, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand, letterSpacing: 1, marginBottom: 18 },
  row: { flexDirection: "row", marginBottom: 8 },
  label: { width: 110, color: PDF_COLORS.muted },
  value: { flex: 1, fontFamily: "Montserrat-Bold" },
  note: { marginTop: 24, color: PDF_COLORS.muted, fontSize: 10, lineHeight: 1.5 },
  code: { position: "absolute", bottom: 32, left: 48, color: PDF_COLORS.faint, fontSize: 8 },
});

/** Comprovante de agendamento para entregar ou mandar ao paciente. */
export async function renderAppointmentProofPdf(proof: AppointmentProof, clinic: Letterhead): Promise<Buffer> {
  registerPdfFonts();
  const rows: [string, string][] = [
    ["Paciente", proof.patientName],
    ["Data", proof.dateText],
    ["Horário", proof.timeText],
    ["Profissional", proof.professionalName],
    ["Local", [proof.unitName, proof.unitAddress].filter(Boolean).join(" · ")],
    ...(proof.unitPhone ? ([["Telefone", formatPhone(proof.unitPhone)]] as [string, string][]) : []),
    ...(proof.procedures.length ? ([["Procedimentos", proof.procedures.join(", ")]] as [string, string][]) : []),
  ];
  const doc = (
    <Document title={`Comprovante de agendamento - ${proof.patientName}`} author={clinic.name} language="pt-BR">
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          {clinic.logo ? <Image style={styles.logo} src={{ data: clinic.logo.data, format: clinic.logo.format }} /> : null}
          <View>
            <Text style={styles.clinic}>{clinic.name}</Text>
            <Text style={styles.muted}>
              {[clinic.legal_name, clinic.document_cnpj_cpf ? formatCpfCnpj(clinic.document_cnpj_cpf) : null, clinic.phone ? formatPhone(clinic.phone) : null].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>COMPROVANTE DE AGENDAMENTO</Text>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
        <Text style={styles.note}>Chegue com 10 minutos de antecedência. Se não puder vir, avise a clínica para remarcar.</Text>
        <Text style={styles.code}>Agendamento {proof.id.slice(0, 8).toUpperCase()}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
