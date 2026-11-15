import "server-only";

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatDateTime } from "@/lib/format";

import { documentKindLabels, type DocumentKind } from "./labels";

export type Letterhead = {
  name: string;
  legal_name: string | null;
  document_cnpj_cpf: string | null;
  phone: string | null;
  email: string | null;
  logo: { data: Buffer; format: "png" | "jpg" } | null;
};

type DocumentPdfInput = {
  kind: DocumentKind;
  title: string;
  body: string;
  professional: { name: string; cro: string | null } | null;
  patientName: string;
  patientAddress: string;
  clinicAddress: string;
  issuedAt: Date;
  documentId: string;
};

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#111827", lineHeight: 1.5 },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: "#d1d5db", paddingBottom: 12, marginBottom: 24 },
  logo: { width: 48, height: 48, objectFit: "contain", marginRight: 12 },
  clinic: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280", fontSize: 9 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 20, textTransform: "uppercase", letterSpacing: 1 },
  paragraph: { marginBottom: 8, textAlign: "justify" },
  signature: { marginTop: 48, alignSelf: "center", width: 260, borderTopWidth: 0.5, borderTopColor: "#111827", paddingTop: 4, textAlign: "center" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#9ca3af", textAlign: "center" },
  via: { flex: 1, padding: 14, borderWidth: 0.5, borderColor: "#9ca3af", fontSize: 9, lineHeight: 1.4 },
  box: { borderWidth: 0.5, borderColor: "#9ca3af", padding: 6, marginTop: 6, flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
});

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <Text key={i} style={s.paragraph}>
          {p}
        </Text>
      ))}
    </>
  );
}

function Header({ clinic, clinicAddress }: { clinic: Letterhead; clinicAddress: string }) {
  return (
    <View style={s.header}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
      {clinic.logo ? <Image style={s.logo} src={{ data: clinic.logo.data, format: clinic.logo.format }} /> : null}
      <View>
        <Text style={s.clinic}>{clinic.name}</Text>
        <Text style={s.muted}>{[clinicAddress, clinic.phone, clinic.email].filter(Boolean).join(" · ")}</Text>
      </View>
    </View>
  );
}

/** Receita de controle especial: duas vias na mesma folha (1ª farmácia, 2ª paciente). */
function SpecialPrescriptionVia({ input, clinic, via }: { input: DocumentPdfInput; clinic: Letterhead; via: string }) {
  return (
    <View style={s.via}>
      <Text style={[s.bold, { fontSize: 10, textAlign: "center" }]}>RECEITUÁRIO DE CONTROLE ESPECIAL — {via}</Text>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
        <View style={s.box}>
          <Text style={s.bold}>Identificação do emitente</Text>
          <Text>{input.professional?.name}</Text>
          <Text>{input.professional?.cro ? `CRO ${input.professional.cro}` : ""}</Text>
          <Text>{clinic.name}</Text>
          <Text>{input.clinicAddress}</Text>
        </View>
      </View>
      <Text style={{ marginTop: 6 }}>
        <Text style={s.bold}>Paciente: </Text>
        {input.patientName}
      </Text>
      <Text>
        <Text style={s.bold}>Endereço: </Text>
        {input.patientAddress || "________________________________"}
      </Text>
      <Text style={{ marginTop: 8 }}>{input.body}</Text>
      <Text style={{ marginTop: 18, textAlign: "center" }}>__________________________________</Text>
      <Text style={{ textAlign: "center" }}>Assinatura do prescritor</Text>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
        <View style={s.box}>
          <Text style={s.bold}>Identificação do comprador</Text>
          <Text>Nome: ______________________</Text>
          <Text>RG: __________ Órgão: ______</Text>
          <Text>Endereço: ___________________</Text>
          <Text>Telefone: ___________________</Text>
        </View>
        <View style={s.box}>
          <Text style={s.bold}>Identificação do fornecedor</Text>
          <Text> </Text>
          <Text>______________________</Text>
          <Text>Assinatura do farmacêutico</Text>
          <Text>Data: ____/____/______</Text>
        </View>
      </View>
    </View>
  );
}

export async function renderDocumentPdf(input: DocumentPdfInput, clinic: Letterhead): Promise<Buffer> {
  const footer = `${documentKindLabels[input.kind]} · emitido em ${formatDateTime(input.issuedAt)} · código ${input.documentId.slice(0, 8).toUpperCase()}`;
  const doc =
    input.kind === "special_prescription" ? (
      <Document title={input.title} author={clinic.name} language="pt-BR">
        <Page size="A4" orientation="landscape" style={[s.page, { padding: 24, flexDirection: "row", gap: 16 }]}>
          <SpecialPrescriptionVia input={input} clinic={clinic} via="1ª VIA: FARMÁCIA" />
          <SpecialPrescriptionVia input={input} clinic={clinic} via="2ª VIA: PACIENTE" />
          <Text style={[s.footer, { bottom: 8 }]} fixed>
            {footer}
          </Text>
        </Page>
      </Document>
    ) : (
      <Document title={input.title} author={clinic.name} language="pt-BR">
        <Page size="A4" style={s.page}>
          <Header clinic={clinic} clinicAddress={input.clinicAddress} />
          <Text style={s.title}>{input.title}</Text>
          {input.kind === "prescription" ? (
            <Text style={{ marginBottom: 12 }}>
              <Text style={s.bold}>Paciente: </Text>
              {input.patientName}
            </Text>
          ) : null}
          <Paragraphs text={input.body} />
          {input.professional ? (
            <View style={s.signature} wrap={false}>
              <Text>{input.professional.name}</Text>
              {input.professional.cro ? <Text style={s.muted}>CRO {input.professional.cro}</Text> : null}
            </View>
          ) : null}
          <Text style={s.footer} fixed>
            {footer}
          </Text>
        </Page>
      </Document>
    );
  return renderToBuffer(doc);
}
