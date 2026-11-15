import "server-only";

import { createClient } from "@/lib/supabase/server";
import { utcToZoned, zonedToUtc } from "@/lib/timezone";

import { computeStatement, type Plan, type Rule } from "./calc";

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start: zonedToUtc(`${month}-01`, "00:00").toISOString(), end: zonedToUtc(next, "00:00").toISOString() };
}

export async function getCommissionSettings() {
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  const { data } = await supabase.from("clinics").select("commission_base, commission_deduct_fees, commission_deduct_lab").eq("id", clinicId as string).single();
  return {
    base: (data?.commission_base ?? "received") as "received" | "executed",
    deductFees: data?.commission_deduct_fees ?? true,
    deductLab: data?.commission_deduct_lab ?? true,
  };
}

/** Extrato do profissional no mês (a RLS limita: dentista só lê os próprios recebíveis). */
export async function getStatement(professionalId: string, month: string) {
  const supabase = await createClient();
  const { start, end } = monthRange(month);
  const [settings, { data: professional }, { data: rules }, { data: closing }] = await Promise.all([
    getCommissionSettings(),
    supabase.from("professionals").select("id, name, commission_percent").eq("id", professionalId).maybeSingle(),
    supabase.from("commission_rules").select("procedure_id, category, percent, fixed_cents").eq("professional_id", professionalId),
    supabase.from("commission_closings").select("*").eq("professional_id", professionalId).eq("period_month", `${month}-01`).maybeSingle(),
  ]);
  if (!professional) return null;

  let planIds: string[] = [];
  let payments: { id: string; date: string; patientName: string; description: string; paidCents: number; feeCents: number; planId: string | null }[] = [];
  let executed: { planId: string; patientName: string }[] = [];

  if (settings.base === "received") {
    const { data } = await supabase
      .from("receivables")
      .select("id, description, paid_amount_cents, fee_cents, paid_at, plan_id, patients(full_name)")
      .eq("professional_id", professionalId)
      .eq("status", "paid")
      .gte("paid_at", start)
      .lt("paid_at", end);
    payments = (data ?? []).map((r) => ({
      id: r.id,
      date: utcToZoned(r.paid_at!).date,
      patientName: r.patients?.full_name ?? "",
      description: r.description,
      paidCents: r.paid_amount_cents ?? 0,
      feeCents: r.fee_cents,
      planId: r.plan_id,
    }));
    planIds = [...new Set(payments.map((p) => p.planId).filter((id): id is string => Boolean(id)))];
  } else {
    const { data: done } = await supabase.from("treatment_items").select("plan_id").eq("status", "done").gte("done_at", start).lt("done_at", end);
    planIds = [...new Set((done ?? []).map((d) => d.plan_id))];
  }

  const { data: planRows } = planIds.length
    ? await supabase
        .from("treatment_plans")
        .select("id, discount_cents, professional_id, patients(full_name), treatment_items(id, description, procedure_id, price_cents, lab_cost_cents, status, done_at, procedures(category))")
        .in("id", planIds)
    : { data: [] };
  const plans: Plan[] = (planRows ?? []).map((p) => ({
    id: p.id,
    discountCents: p.discount_cents,
    items: p.treatment_items.map((i) => ({
      id: i.id,
      description: i.description,
      procedureId: i.procedure_id,
      category: i.procedures?.category ?? null,
      priceCents: i.price_cents,
      labCostCents: i.lab_cost_cents,
      status: i.status,
      doneAt: i.done_at ? utcToZoned(i.done_at).date : null,
    })),
  }));
  if (settings.base === "executed") {
    executed = (planRows ?? []).filter((p) => p.professional_id === professionalId).map((p) => ({ planId: p.id, patientName: p.patients?.full_name ?? "" }));
  }

  const statement = computeStatement({
    settings,
    defaultPercent: Number(professional.commission_percent ?? 0),
    rules: (rules ?? []).map((r): Rule => ({ procedureId: r.procedure_id, category: r.category, percent: r.percent === null ? null : Number(r.percent), fixedCents: r.fixed_cents })),
    plans,
    payments,
    executed,
    month,
  });
  return { professional, settings, statement, closing };
}

export async function listCommissionSetup() {
  const supabase = await createClient();
  const [{ data: professionals }, { data: rules }, { data: procedures }] = await Promise.all([
    supabase.from("professionals").select("id, name, commission_percent, active").order("name"),
    supabase.from("commission_rules").select("id, professional_id, procedure_id, category, percent, fixed_cents, procedures(name)"),
    supabase.from("procedures").select("id, name, category").eq("active", true).order("name"),
  ]);
  const categories = [...new Set((procedures ?? []).map((p) => p.category).filter((c): c is string => Boolean(c)))].sort();
  return { professionals: professionals ?? [], rules: rules ?? [], procedures: procedures ?? [], categories };
}

export async function listClosings(professionalId: string | null) {
  const supabase = await createClient();
  let query = supabase.from("commission_closings").select("id, period_month, total_commission_cents, total_base_cents, closed_at, pdf_path, professionals(name)").order("period_month", { ascending: false }).limit(36);
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data } = await query;
  return data ?? [];
}
