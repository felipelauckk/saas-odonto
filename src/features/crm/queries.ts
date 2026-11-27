import "server-only";

import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { addDays, zonedToUtc } from "@/lib/timezone";

import type { StageKind } from "./labels";

export type CrmStage = { id: string; name: string; position: number; kind: StageKind; autoKey: string | null };
export type CrmLead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** Origem (patient_sources). */
  sourceId: string | null;
  campaignId: string | null;
  procedureId: string | null;
  interest: string | null;
  notes: string | null;
  stageId: string;
  stageChangedAt: string;
  lostReason: string | null;
  patientId: string | null;
  referral: string;
  referralName: string | null;
  createdAt: string;
  fromPublicForm: boolean;
};

export async function listStages(): Promise<CrmStage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_stages").select("id, name, position, kind, auto_key").order("position");
  if (error) throw error;
  return data.map((s) => ({ id: s.id, name: s.name, position: s.position, kind: s.kind, autoKey: s.auto_key }));
}

/** Funil: leads abertos e os fechados/perdidos dos últimos 60 dias. */
export async function getCrmBoard(today: string) {
  const supabase = await createClient();
  const [stages, leadsRes, campaignsRes, partnersRes, proceduresRes] = await Promise.all([
    listStages(),
    fetchAll((a, b) =>
      supabase
        .from("leads")
        .select(
          "id, name, phone, email, source_id, campaign_id, procedure_id, interest, notes, stage_id, stage_changed_at, lost_reason, patient_id, referred_by_patient_id, referred_by_partner_id, created_at, from_public_form, crm_stages(kind), referrer:patients!leads_referred_by_patient_id_clinic_id_fkey(full_name), referral_partners(name)",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, b),
    ).then((data) => ({ data, error: null })),
    supabase.from("crm_campaigns").select("id, name, source_id, cost_cents, active").order("name"),
    supabase.from("referral_partners").select("id, name, phone, notes, active").order("name"),
    supabase.from("procedures").select("id, name").eq("active", true).order("name"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  const cutoff = zonedToUtc(addDays(today, -60), "00:00").toISOString();
  const leads: CrmLead[] = (leadsRes.data ?? [])
    .filter((l) => l.crm_stages?.kind === "open" || l.stage_changed_at >= cutoff)
    .map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      sourceId: l.source_id,
      campaignId: l.campaign_id,
      procedureId: l.procedure_id,
      interest: l.interest,
      notes: l.notes,
      stageId: l.stage_id,
      stageChangedAt: l.stage_changed_at,
      lostReason: l.lost_reason,
      patientId: l.patient_id,
      referral: l.referred_by_patient_id ? `patient:${l.referred_by_patient_id}` : l.referred_by_partner_id ? `partner:${l.referred_by_partner_id}` : "",
      referralName: l.referrer?.full_name ?? l.referral_partners?.name ?? null,
      createdAt: l.created_at,
      fromPublicForm: l.from_public_form,
    }));
  return {
    stages,
    leads,
    campaigns: campaignsRes.data ?? [],
    partners: partnersRes.data ?? [],
    procedures: proceduresRes.data ?? [],
  };
}

/** Conversão por origem e campanha, e ranking de indicação, para leads criados no período. */
export async function getCrmReport(from: string, to: string) {
  const supabase = await createClient();
  const [leadsRes, campaignsRes, patientsRes, sourcesRes] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("leads")
        .select("id, source_id, patient_id, campaign_id, referred_by_patient_id, referred_by_partner_id, crm_stages(kind)")
        .gte("created_at", zonedToUtc(from, "00:00").toISOString())
        .lt("created_at", zonedToUtc(addDays(to, 1), "00:00").toISOString())
        .order("id")
        .range(a, b),
    ).then((data) => ({ data, error: null })),
    supabase.from("crm_campaigns").select("id, name, cost_cents"),
    fetchAll((a, b) =>
      supabase
        .from("patients")
        .select("id, referred_by_patient_id, referred_by_partner_id")
        .or("referred_by_patient_id.not.is.null,referred_by_partner_id.not.is.null")
        .gte("created_at", zonedToUtc(from, "00:00").toISOString())
        .lt("created_at", zonedToUtc(addDays(to, 1), "00:00").toISOString())
        .order("id")
        .range(a, b),
    ).then((data) => ({ data, error: null })),
    supabase.from("patient_sources").select("id, name"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (patientsRes.error) throw patientsRes.error;
  const sourceName = new Map((sourcesRes.data ?? []).map((s) => [s.id, s.name]));
  const leads = leadsRes.data ?? [];

  type Row = { leads: number; converted: number; won: number; lost: number };
  const empty = (): Row => ({ leads: 0, converted: 0, won: 0, lost: 0 });
  const bySource = new Map<string, Row>();
  const byCampaign = new Map<string, Row>();
  for (const l of leads) {
    for (const [map, key] of [[bySource, l.source_id], [byCampaign, l.campaign_id]] as const) {
      if (!key) continue;
      const row = (map as Map<string, Row>).get(key) ?? empty();
      row.leads++;
      if (l.patient_id) row.converted++;
      if (l.crm_stages?.kind === "won") row.won++;
      if (l.crm_stages?.kind === "lost") row.lost++;
      (map as Map<string, Row>).set(key, row);
    }
  }

  // Ranking: leads indicados + pacientes cadastrados direto com indicação (sem contar duas vezes o convertido).
  const convertedIds = new Set(leads.map((l) => l.patient_id).filter(Boolean));
  const referrals = new Map<string, { leads: number; won: number }>();
  const add = (key: string | null, won: boolean) => {
    if (!key) return;
    const r = referrals.get(key) ?? { leads: 0, won: 0 };
    r.leads++;
    if (won) r.won++;
    referrals.set(key, r);
  };
  for (const l of leads) {
    add(l.referred_by_patient_id ? `patient:${l.referred_by_patient_id}` : l.referred_by_partner_id ? `partner:${l.referred_by_partner_id}` : null, l.crm_stages?.kind === "won");
  }
  for (const p of patientsRes.data ?? []) {
    if (convertedIds.has(p.id)) continue;
    add(p.referred_by_patient_id ? `patient:${p.referred_by_patient_id}` : p.referred_by_partner_id ? `partner:${p.referred_by_partner_id}` : null, false);
  }
  const patientIds = [...referrals.keys()].filter((k) => k.startsWith("patient:")).map((k) => k.slice(8));
  const partnerIds = [...referrals.keys()].filter((k) => k.startsWith("partner:")).map((k) => k.slice(8));
  const [{ data: refPatients }, { data: refPartners }] = await Promise.all([
    patientIds.length ? supabase.from("patients").select("id, full_name").in("id", patientIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    partnerIds.length ? supabase.from("referral_partners").select("id, name").in("id", partnerIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const names = new Map<string, string>([
    ...(refPatients ?? []).map((p) => [`patient:${p.id}`, p.full_name] as const),
    ...(refPartners ?? []).map((p) => [`partner:${p.id}`, p.name] as const),
  ]);
  const ranking = [...referrals.entries()]
    .map(([key, r]) => ({ key, name: names.get(key) ?? "—", kind: key.startsWith("patient:") ? ("Paciente" as const) : ("Parceiro" as const), ...r }))
    .sort((a, b) => b.leads - a.leads || b.won - a.won || a.name.localeCompare(b.name));

  return {
    total: leads.length,
    bySource: [...bySource.entries()].map(([sourceId, r]) => ({ sourceId, name: sourceName.get(sourceId) ?? "Origem", ...r })).sort((a, b) => b.leads - a.leads),
    byCampaign: (campaignsRes.data ?? [])
      .map((c) => ({ id: c.id, name: c.name, costCents: c.cost_cents, ...(byCampaign.get(c.id) ?? empty()) }))
      .filter((c) => c.leads > 0 || c.costCents > 0)
      .sort((a, b) => b.leads - a.leads),
    ranking,
  };
}
