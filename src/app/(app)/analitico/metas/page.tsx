import type { Metadata } from "next";
import { z } from "zod";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { PeriodFilter } from "@/features/payables/components/period-filter";
import { GoalsEditor } from "@/features/analytics/components/goals-editor";
import type { GoalMetric } from "@/features/analytics/logic";
import { requireManager } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Metas" };

export default async function Page({ searchParams }: PageProps<"/analitico/metas">) {
  const session = await requireManager();
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(todayIso().slice(0, 7)).parse((await searchParams).mes);
  const supabase = await createClient();
  const [{ data: goals }, { data: pros }] = await Promise.all([
    supabase.from("goals").select("metric, unit_id, professional_id, target").eq("month", `${month}-01`),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
  ]);
  const scopes = [
    { key: "clinic", label: "Clínica (total)", unitId: null, professionalId: null },
    ...(session.units.length > 1 ? session.units.map((u) => ({ key: `u:${u.id}`, label: `Unidade ${u.name}`, unitId: u.id, professionalId: null })) : []),
    ...(pros ?? []).map((p) => ({ key: `p:${p.id}`, label: p.name, unitId: null, professionalId: p.id })),
  ];
  return (
    <div className="space-y-6">
      <SubpageHeader title="Metas" description="Metas mensais da clínica, das unidades e de cada profissional." backHref={`/analitico?mes=${month}`} backLabel="Painel analítico" />
      <PeriodFilter fields={[{ name: "mes", label: "Mês", type: "month", value: month }]} />
      <GoalsEditor
        key={month}
        month={month}
        scopes={scopes}
        goals={(goals ?? []).map((g) => ({ metric: g.metric as GoalMetric, unitId: g.unit_id, professionalId: g.professional_id, target: Number(g.target) }))}
      />
    </div>
  );
}
