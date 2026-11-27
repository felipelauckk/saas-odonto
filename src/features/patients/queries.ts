import "server-only";

import { cache } from "react";

import { isOverdue } from "@/features/finance/patient-status";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

import { PAGE_SIZE } from "./labels";
import type { PatientSourceOption } from "./sources";

type SearchParams = {
  q: string;
  status: "active" | "archived";
  /** Origem (id da lista patient_sources). */
  sourceId: string | null;
  segment: "in_treatment" | "open_quote" | "return_overdue" | "birthday" | null;
  page: number;
};

/** Lista da tela de pacientes, já com última/próxima visita, saldo e situação (função `patients_page`). */
export async function searchPatients({ q, status, sourceId, segment, page }: SearchParams) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("patients_page", {
    _query: q,
    _segment: status === "archived" ? "archived" : (segment ?? "active"),
    _source_id: sourceId ?? undefined,
    _limit: PAGE_SIZE,
    _offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const total = Number(data[0]?.total_count ?? 0);
  return { patients: data, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type PatientListRow = Awaited<ReturnType<typeof searchPatients>>["patients"][number];

/** Quantos pacientes há em cada filtro rápido, com a mesma busca e origem. */
export async function getSegmentCounts({ q, sourceId }: { q: string; sourceId: string | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("patients_segment_counts", { _query: q, _source_id: sourceId ?? undefined });
  if (error) throw error;
  const row = data[0];
  const n = (v: number | undefined) => Number(v ?? 0);
  return {
    active: n(row?.active),
    in_treatment: n(row?.in_treatment),
    open_quote: n(row?.open_quote),
    return_overdue: n(row?.return_overdue),
    birthday: n(row?.birthday),
    archived: n(row?.archived),
  };
}

/** Cache por requisição: o layout da ficha e a aba usam o mesmo resultado. */
export const getPatient = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").select("*, patient_sources(name, key), referral_partners(name), patient_phones(id, label, number)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Quem indicou (paciente): leitura à parte, a relação do paciente com ele mesmo não é embutível.
  let referrerName: string | null = null;
  if (data.referred_by_patient_id) {
    const { data: ref } = await supabase.from("patients").select("full_name").eq("id", data.referred_by_patient_id).maybeSingle();
    referrerName = ref?.full_name ?? null;
  }
  return { ...data, referrer_name: referrerName };
});

export type Patient = NonNullable<Awaited<ReturnType<typeof getPatient>>>;

/** A clínica tem algum paciente (ativo ou arquivado)? */
export async function hasAnyPatient(): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase.from("patients").select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

/**
 * Faixa de resumo da ficha: próxima consulta, última visita e o que está em aberto.
 * O saldo só é lido quando pedido (quem opera o financeiro); o resto respeita a RLS.
 */
export const getPatientSummary = cache(async (patientId: string, withBalance: boolean) => {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [next, last, open] = await Promise.all([
    supabase
      .from("appointments")
      .select("starts_at, type")
      .eq("patient_id", patientId)
      .gte("starts_at", now)
      .not("status", "in", "(canceled,no_show,done)")
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("starts_at, type")
      .eq("patient_id", patientId)
      .eq("status", "done")
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    withBalance
      ? supabase.from("receivables").select("amount_cents, status, due_date").eq("patient_id", patientId).in("status", ["open", "overdue"])
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (next.error) throw next.error;
  if (last.error) throw last.error;
  if (open.error) throw open.error;
  const rows = open.data ?? [];
  return {
    next: next.data,
    last: last.data,
    balance: withBalance
      ? {
          openCents: rows.reduce((s, r) => s + r.amount_cents, 0),
          // Mesma regra do cartão da consulta: aberta com vencimento passado também é vencida.
          overdueCents: rows.filter((r) => isOverdue(r, todayIso())).reduce((s, r) => s + r.amount_cents, 0),
        }
      : null,
  };
});

/** Origens da clínica (todas, com as desativadas), na ordem da lista. */
export const getPatientSources = cache(async (): Promise<PatientSourceOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patient_sources").select("id, name, key, active, position").order("position").order("name");
  if (error) throw error;
  return data ?? [];
});

/** Notas gerais do paciente: fixadas primeiro, depois as mais novas. */
export async function getPatientNotes(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_notes")
    .select("id, body, pinned, created_by, author_name, created_at")
    .eq("patient_id", patientId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export type PatientNote = Awaited<ReturnType<typeof getPatientNotes>>[number];

/**
 * Aba Resumo: próxima consulta, retorno pendente, orçamentos em aberto,
 * anamnese e últimas evoluções. O prontuário só vem para quem pode ler (RLS);
 * `clinical` diz se a leitura vale.
 */
export async function getPatientOverview(patientId: string, clinical: boolean) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [next, ret, plans, anamnesis, evolutions] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, type, professionals(name)")
      .eq("patient_id", patientId)
      .gte("starts_at", now)
      .not("status", "in", "(canceled,no_show,done)")
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("patient_returns").select("id, due_date, reason").eq("patient_id", patientId).eq("status", "pending").order("due_date").limit(1).maybeSingle(),
    supabase.from("treatment_plans").select("id, status, total_cents, discount_cents, created_at").eq("patient_id", patientId).in("status", ["draft", "presented"]).order("created_at", { ascending: false }),
    clinical
      ? supabase.from("anamneses").select("created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    clinical
      ? supabase.from("clinical_notes").select("id, body, created_at, professionals(name)").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [next, ret, plans, anamnesis, evolutions]) if (r.error) throw r.error;
  return {
    next: next.data,
    pendingReturn: ret.data,
    openPlans: plans.data ?? [],
    anamnesisAt: anamnesis.data?.created_at ?? null,
    evolutions: evolutions.data ?? [],
  };
}
