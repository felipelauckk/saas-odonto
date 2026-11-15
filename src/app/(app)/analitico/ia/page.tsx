import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { InsightsPanel } from "@/features/ai/components/insights-panel";
import { requireManager } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Perguntas e resumo com IA" };

export default async function Page() {
  await requireManager();
  const supabase = await createClient();
  const { data } = await supabase.from("ai_insights").select("id, month, body, created_at").order("created_at", { ascending: false }).limit(12);
  return (
    <div className="space-y-6">
      <SubpageHeader title="Perguntas e resumo com IA" description="Pergunte em português sobre os números da clínica e gere o resumo do mês." backHref="/analitico" backLabel="Painel analítico" />
      <InsightsPanel month={todayIso().slice(0, 7)} summaries={data ?? []} />
    </div>
  );
}
