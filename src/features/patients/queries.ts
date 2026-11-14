import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { PAGE_SIZE, type PatientSource } from "./labels";

type SearchParams = { q: string; status: "active" | "archived"; source: PatientSource | null; page: number };

export async function searchPatients({ q, status, source, page }: SearchParams) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_patients", {
    _query: q,
    _status: status,
    _source: source ?? undefined,
    _limit: PAGE_SIZE,
    _offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const total = Number(data[0]?.total_count ?? 0);
  return { patients: data, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
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
