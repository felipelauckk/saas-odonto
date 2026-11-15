import "server-only";

import { createCharge } from "@/features/charges/service";
import { createSignatureRequest } from "@/features/documents/signing";
import { generateToken, sha256Hex } from "@/lib/hash";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcToZoned } from "@/lib/timezone";

export const PORTAL_DAYS = 30;

/** Cria o link mágico do portal (só o hash fica no banco). */
export async function issuePortalToken() {
  const token = generateToken();
  return { token, hash: sha256Hex(token), expiresAt: new Date(Date.now() + PORTAL_DAYS * 86_400_000).toISOString() };
}

export type PortalSession = { linkId: string; clinicId: string; patientId: string; patientName: string; clinicName: string };

export async function openPortal(token: string): Promise<PortalSession | null> {
  if (!/^[A-Za-z0-9_-]{30,100}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("portal_links")
    .select("id, clinic_id, patient_id, expires_at, revoked_at, patients(full_name, archived_at), clinics(name)")
    .eq("token_hash", sha256Hex(token))
    .maybeSingle();
  if (!link || link.revoked_at || Date.parse(link.expires_at) < Date.now() || link.patients?.archived_at) return null;
  await admin.from("portal_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);
  return { linkId: link.id, clinicId: link.clinic_id, patientId: link.patient_id, patientName: link.patients?.full_name ?? "", clinicName: link.clinics?.name ?? "" };
}

/** Tudo que o paciente vê no portal — sempre filtrado pelo paciente do link. */
export async function loadPortal(s: PortalSession) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [appts, plans, receivables, charges, documents, anamnesis] = await Promise.all([
    admin
      .from("appointments")
      .select("id, starts_at, status, type, reschedule_requested_at, professionals(name), units(name)")
      .eq("patient_id", s.patientId)
      .gte("starts_at", now)
      .not("status", "in", "(canceled,no_show)")
      .order("starts_at")
      .limit(10),
    admin
      .from("treatment_plans")
      .select("id, status, total_cents, discount_cents, installments, presented_at, approved_at, professionals(name), treatment_items(description, tooth, price_cents, status, position)")
      .eq("patient_id", s.patientId)
      .in("status", ["presented", "approved", "partially_approved", "completed"])
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("receivables").select("id, description, amount_cents, due_date, status").eq("patient_id", s.patientId).in("status", ["open", "overdue"]).order("due_date"),
    admin.from("patient_charges").select("receivable_ids, invoice_url, status").eq("patient_id", s.patientId).in("status", ["pending", "overdue"]),
    admin.from("patient_documents").select("id, title, kind, status, created_at").eq("patient_id", s.patientId).neq("status", "canceled").order("created_at", { ascending: false }).limit(20),
    admin.from("anamnesis_templates").select("id").eq("clinic_id", s.clinicId).eq("is_default", true).eq("active", true).maybeSingle(),
  ]);
  const chargeFor = (id: string) => (charges.data ?? []).find((c) => c.receivable_ids.includes(id))?.invoice_url ?? null;
  return {
    appointments: (appts.data ?? []).map((a) => {
      const z = utcToZoned(a.starts_at);
      return { id: a.id, date: z.date, time: z.time, status: a.status, type: a.type, professional: a.professionals?.name ?? null, unit: a.units?.name ?? null, rescheduleRequested: Boolean(a.reschedule_requested_at) };
    }),
    plans: (plans.data ?? []).map((p) => ({
      id: p.id,
      status: p.status,
      totalCents: p.total_cents,
      discountCents: p.discount_cents,
      installments: p.installments,
      professional: p.professionals?.name ?? null,
      items: [...p.treatment_items].sort((a, b) => a.position - b.position).map((i) => ({ description: i.description, tooth: i.tooth, priceCents: i.price_cents, status: i.status })),
    })),
    receivables: (receivables.data ?? []).map((r) => ({ ...r, invoiceUrl: chargeFor(r.id) })),
    documents: documents.data ?? [],
    hasAnamnesis: Boolean(anamnesis.data),
  };
}

export async function portalConfirmAppointment(s: PortalSession, appointmentId: string): Promise<{ error?: string }> {
  const { data, error } = await createAdminClient()
    .from("appointments")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("patient_id", s.patientId)
    .eq("status", "scheduled")
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível confirmar." };
  return {};
}

export async function portalRequestReschedule(s: PortalSession, appointmentId: string): Promise<{ error?: string }> {
  const { data, error } = await createAdminClient()
    .from("appointments")
    .update({ reschedule_requested_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("patient_id", s.patientId)
    .gte("starts_at", new Date().toISOString())
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível pedir a remarcação." };
  return {};
}

export async function portalApprovePlan(s: PortalSession, planId: string): Promise<{ error?: string }> {
  const { error } = await createAdminClient().rpc("portal_approve_plan", { _plan_id: planId, _patient_id: s.patientId });
  if (error) return { error: error.code === "OT003" ? (error.message ?? "Orçamento indisponível.") : "Não foi possível aprovar agora." };
  return {};
}

/** Link de pagamento da parcela: reaproveita a cobrança em aberto ou gera uma (cartão, Pix ou boleto). */
export async function portalPayReceivable(s: PortalSession, receivableId: string): Promise<{ error?: string; url?: string }> {
  const admin = createAdminClient();
  const { data: r } = await admin.from("receivables").select("id, status").eq("id", receivableId).eq("patient_id", s.patientId).maybeSingle();
  if (!r || (r.status !== "open" && r.status !== "overdue")) return { error: "Parcela não encontrada." };
  const { data: open } = await admin.from("patient_charges").select("invoice_url").eq("patient_id", s.patientId).in("status", ["pending", "overdue"]).contains("receivable_ids", [receivableId]).limit(1).maybeSingle();
  if (open?.invoice_url) return { url: open.invoice_url };
  try {
    // A parcela já foi conferida acima (é deste paciente): o cliente do servidor pode ler e gravar.
    const result = await createCharge({ supabase: admin, clinicId: s.clinicId, userId: null }, { receivableIds: [receivableId], kind: "link", installments: 1, dueDate: null });
    if (result.error || !result.charge?.invoiceUrl) return { error: result.error?.includes("Conecte") ? "Pagamento online indisponível. Fale com a clínica." : (result.error ?? "Não foi possível gerar o pagamento.") };
    return { url: result.charge.invoiceUrl };
  } catch {
    return { error: "Não foi possível gerar o pagamento agora." };
  }
}

/** Link de assinatura de um documento do paciente ou da anamnese. */
export async function portalSignLink(s: PortalSession, target: { documentId: string } | { anamnesis: true }): Promise<{ error?: string; token?: string }> {
  const admin = createAdminClient();
  if ("documentId" in target) {
    const { data: doc } = await admin.from("patient_documents").select("id, status").eq("id", target.documentId).eq("patient_id", s.patientId).maybeSingle();
    if (!doc || doc.status !== "issued") return { error: "Documento indisponível para assinatura." };
    const { token } = await createSignatureRequest({ clinicId: s.clinicId, patientId: s.patientId, documentId: doc.id, days: 1, createdBy: null });
    return { token };
  }
  const { data: template } = await admin.from("anamnesis_templates").select("id").eq("clinic_id", s.clinicId).eq("is_default", true).eq("active", true).maybeSingle();
  if (!template) return { error: "Anamnese indisponível." };
  const { token } = await createSignatureRequest({ clinicId: s.clinicId, patientId: s.patientId, anamnesisTemplateId: template.id, days: 1, createdBy: null });
  return { token };
}
