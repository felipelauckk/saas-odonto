"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/features/tenancy/queries";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { parseBRLToCents, parseDecimal } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { goalMetrics, metricKind, type GoalMetric } from "./logic";

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  goals: z
    .array(
      z.object({
        metric: z.enum(goalMetrics as [GoalMetric, ...GoalMetric[]]),
        unitId: z.uuid().nullable(),
        professionalId: z.uuid().nullable(),
        value: z.string().max(30),
      }),
    )
    .max(500),
});

/** Salva as metas do mês: campo vazio remove a meta. */
export async function saveGoals(input: z.input<typeof schema>): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const session = await getSessionContext();
  const role = session?.clinic?.role;
  if (!session?.clinic || (role !== "owner" && role !== "manager")) return { error: "Sem permissão." };
  const supabase = await createClient();
  const month = `${parsed.data.month}-01`;

  const rows: { clinic_id: string; month: string; metric: GoalMetric; unit_id: string | null; professional_id: string | null; target: number }[] = [];
  for (const g of parsed.data.goals) {
    const raw = g.value.trim();
    if (!raw) continue;
    const kind = metricKind[g.metric];
    const target = kind === "money" ? parseBRLToCents(raw) : kind === "percent" ? (parseDecimal(raw.replace("%", "")) ?? NaN) / 100 : parseDecimal(raw);
    if (target === null || !Number.isFinite(target) || target < 0 || (kind === "percent" && target > 1)) return { error: `Valor inválido: ${raw}` };
    rows.push({ clinic_id: session.clinic.id, month, metric: g.metric, unit_id: g.unitId, professional_id: g.professionalId, target });
  }

  // Substitui as metas do mês (é uma tela só, salva tudo junto).
  const { error: delError } = await supabase.from("goals").delete().eq("month", month);
  if (delError) return { error: subscriptionErrorMessage(delError) ?? "Não foi possível salvar." };
  if (rows.length) {
    const { error } = await supabase.from("goals").insert(rows);
    if (error) return { error: subscriptionErrorMessage(error) ?? "Não foi possível salvar." };
  }
  revalidatePath("/analitico", "layout");
  return {};
}
