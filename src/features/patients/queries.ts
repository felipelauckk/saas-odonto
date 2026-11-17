import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { PAGE_SIZE, type PatientSource } from "./labels";

type SearchParams = {
  q: string;
  status: "active" | "archived";
  source: PatientSource | null;
  segment: "in_treatment" | "open_quote" | "return_overdue" | "birthday" | null;
  page: number;
};

/** Lista da tela de pacientes, já com última/próxima visita, saldo e situação (função `patient_list`). */
export async function searchPatients({ q, status, source, segment, page }: SearchParams) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("patient_list", {
    _query: q,
    _segment: status === "archived" ? "archived" : (segment ?? "active"),
    _source: source ?? undefined,
    _limit: PAGE_SIZE,
    _offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const total = Number(data[0]?.total_count ?? 0);
  return { patients: data, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type PatientListRow = Awaited<ReturnType<typeof searchPatients>>["patients"][number];

/** Quantos pacientes há em cada filtro rápido, com a mesma busca e origem. */
export async function getSegmentCounts({ q, source }: { q: string; source: PatientSource | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("patient_segment_counts", { _query: q, _source: source ?? undefined });
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
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
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
      ? supabase.from("receivables").select("amount_cents, status").eq("patient_id", patientId).in("status", ["open", "overdue"])
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
          overdueCents: rows.filter((r) => r.status === "overdue").reduce((s, r) => s + r.amount_cents, 0),
        }
      : null,
  };
});
