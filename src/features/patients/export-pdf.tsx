import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { parseAnswers } from "@/features/clinical/anamnesis";
import { conditionLabels, currentState, faceLabel, type Face } from "@/features/clinical/odontogram";
import { itemStatusLabels, planStatusLabels } from "@/features/plans/labels";
import { receivableStatusLabels } from "@/features/finance/labels";
import { statusLabels } from "@/features/agenda/labels";
import { formatIsoDate } from "@/lib/dates";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { genderLabels } from "./labels";
import { PDF_COLORS, registerPdfFonts } from "@/lib/pdf/fonts";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: "Montserrat", color: PDF_COLORS.text, lineHeight: 1.4 },
  h1: { fontSize: 16, fontFamily: "Montserrat-Black", color: PDF_COLORS.brand, marginBottom: 2 },
  h2: { fontSize: 11.5, fontFamily: "Montserrat-Bold", marginTop: 16, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.border, paddingBottom: 3 },
  muted: { color: PDF_COLORS.muted },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 140, color: PDF_COLORS.muted },
  item: { marginBottom: 6 },
  bold: { fontFamily: "Montserrat-Bold" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: PDF_COLORS.faint, textAlign: "center" },
});

/**
 * Todos os dados do paciente num PDF (direito de acesso, art. 18 da LGPD).
 * Lê com a sessão do usuário: a RLS garante que só sai o que ele pode ver.
 */
export async function renderPatientExport(patientId: string, clinicName: string): Promise<Buffer | null> {
  registerPdfFonts();
  const supabase = await createClient();
  const [patientRes, anamnesesRes, toothRes, notesRes, apptRes, plansRes, recvRes, filesRes] = await Promise.all([
    supabase.from("patients").select("*, patient_sources(name)").eq("id", patientId).maybeSingle(),
    supabase.from("anamneses").select("answers, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
    supabase.from("tooth_records").select("tooth, faces, condition, created_at").eq("patient_id", patientId).order("created_at"),
    supabase.from("clinical_notes").select("body, created_at, complements_note_id, professionals(name)").eq("patient_id", patientId).order("created_at"),
    supabase.from("appointments").select("starts_at, status, type, professionals(name)").eq("patient_id", patientId).order("starts_at"),
    supabase.from("treatment_plans").select("id, status, created_at, discount_cents, treatment_items(description, tooth, price_cents, status)").eq("patient_id", patientId).order("created_at"),
    supabase.from("receivables").select("description, amount_cents, due_date, status, paid_at").eq("patient_id", patientId).order("due_date"),
    supabase.from("patient_files").select("kind, description, created_at").eq("patient_id", patientId).order("created_at"),
  ]);
  const patient = patientRes.data;
  if (!patient) return null;
  const answers = parseAnswers(anamnesesRes.data?.[0]?.answers);
  const teeth = [...currentState(toothRes.data ?? []).entries()].sort(([a], [b]) => a - b);
  const address = patient.address as Record<string, string | null> | null;

  const field = (label: string, value: string | null | undefined) => (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text>{value || "—"}</Text>
    </View>
  );

  const doc = (
    <Document title={`Dados de ${patient.full_name}`} author={clinicName} language="pt-BR">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Dados do paciente</Text>
        <Text style={s.muted}>
          {clinicName} · gerado em {formatDateTime(new Date())} · direito de acesso (LGPD, art. 18)
        </Text>

        <Text style={s.h2}>Identificação e contato</Text>
        {field("Nome", patient.full_name)}
        {field("CPF", patient.cpf ? formatCpfCnpj(patient.cpf) : null)}
        {field("Nascimento", patient.birth_date ? formatIsoDate(patient.birth_date) : null)}
        {field("Gênero", patient.gender ? genderLabels[patient.gender] : null)}
        {field("Telefone", patient.phone ? formatPhone(patient.phone) : null)}
        {field("WhatsApp", patient.whatsapp ? formatPhone(patient.whatsapp) : null)}
        {field("E-mail", patient.email)}
        {field("Endereço", address ? [address.street, address.number, address.complement, address.district, address.city, address.state, address.cep].filter(Boolean).join(", ") : null)}
        {field("Responsável legal", patient.guardian_name ? `${patient.guardian_name}${patient.guardian_cpf ? ` (CPF ${formatCpfCnpj(patient.guardian_cpf)})` : ""}` : null)}
        {field("Como conheceu", patient.patient_sources?.name ?? null)}
        {field("Consentimento LGPD", patient.consent_lgpd_at ? formatDateTime(patient.consent_lgpd_at) : "Não registrado")}
        {field("Observações", patient.notes)}

        <Text style={s.h2}>Anamnese (versão mais recente)</Text>
        {answers.length ? (
          answers.map((a) => (
            <View key={a.id} style={s.row} wrap={false}>
              <Text style={[s.label, { width: 300 }]}>{a.label}</Text>
              <Text>{a.type === "text" ? a.text || "—" : a.answer === "yes" ? `Sim${a.text ? ` — ${a.text}` : ""}` : a.answer === "no" ? "Não" : "—"}</Text>
            </View>
          ))
        ) : (
          <Text style={s.muted}>Não preenchida.</Text>
        )}

        <Text style={s.h2}>Odontograma (situação atual)</Text>
        {teeth.length ? (
          teeth.map(([tooth, state]) => (
            <Text key={tooth}>
              Dente {tooth}: {[state.whole ? conditionLabels[state.whole] : null, ...Object.entries(state.faces).map(([f, c]) => `${faceLabel(f as Face, tooth)} — ${conditionLabels[c!]}`)].filter(Boolean).join("; ")}
            </Text>
          ))
        ) : (
          <Text style={s.muted}>Sem registros.</Text>
        )}

        <Text style={s.h2}>Evoluções clínicas</Text>
        {notesRes.data?.length ? (
          notesRes.data.map((n, i) => (
            <View key={i} style={s.item} wrap={false}>
              <Text style={s.bold}>
                {formatDateTime(n.created_at)} · {n.professionals?.name}
                {n.complements_note_id ? " (complemento)" : ""}
              </Text>
              <Text>{n.body}</Text>
            </View>
          ))
        ) : (
          <Text style={s.muted}>Nenhuma.</Text>
        )}

        <Text style={s.h2}>Consultas</Text>
        {apptRes.data?.length ? (
          apptRes.data.map((a, i) => (
            <Text key={i}>
              {formatDateTime(a.starts_at)} · {a.professionals?.name} · {statusLabels[a.status]}
              {a.type ? ` · ${a.type}` : ""}
            </Text>
          ))
        ) : (
          <Text style={s.muted}>Nenhuma.</Text>
        )}

        <Text style={s.h2}>Orçamentos</Text>
        {plansRes.data?.length ? (
          plansRes.data.map((p) => (
            <View key={p.id} style={s.item} wrap={false}>
              <Text style={s.bold}>
                {formatDate(p.created_at)} · {planStatusLabels[p.status]}
              </Text>
              {p.treatment_items.map((it, i) => (
                <Text key={i}>
                  {it.description}
                  {it.tooth ? ` (dente ${it.tooth})` : ""} · {formatCurrency(it.price_cents)} · {itemStatusLabels[it.status]}
                </Text>
              ))}
            </View>
          ))
        ) : (
          <Text style={s.muted}>Nenhum.</Text>
        )}

        <Text style={s.h2}>Financeiro</Text>
        {recvRes.data?.length ? (
          recvRes.data.map((r, i) => (
            <Text key={i}>
              {r.description} · {formatCurrency(r.amount_cents)} · vence {formatIsoDate(r.due_date)} · {receivableStatusLabels[r.status]}
              {r.paid_at ? ` em ${formatDate(r.paid_at)}` : ""}
            </Text>
          ))
        ) : (
          <Text style={s.muted}>Nenhum lançamento.</Text>
        )}

        <Text style={s.h2}>Arquivos guardados</Text>
        {filesRes.data?.length ? (
          filesRes.data.map((f, i) => (
            <Text key={i}>
              {formatDate(f.created_at)} · {f.kind} {f.description ? `· ${f.description}` : ""}
            </Text>
          ))
        ) : (
          <Text style={s.muted}>Nenhum. (As imagens podem ser entregues à parte, se o paciente pedir.)</Text>
        )}

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${patient.full_name} · página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
