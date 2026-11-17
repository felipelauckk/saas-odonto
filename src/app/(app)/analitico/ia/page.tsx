import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { InsightsPanel } from "@/features/ai/components/insights-panel";
import { requireManager } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAiConfigured } from "@/lib/ai/claude";

export const metadata: Metadata = { title: "Perguntas e resumo com IA" };

export default async function Page({ searchParams }: PageProps<"/analitico/ia">) {
  await requireManager();
  // Sem a chave da IA no servidor a tela não aparece (primeira versão sem IA).
  if (!isAiConfigured()) redirect("/analitico");
  const { pergunta } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("ai_insights").select("id, month, body, created_at").order("created_at", { ascending: false }).limit(12);
  return (
    <div className="space-y-6">
      <SubpageHeader title="Perguntas e resumo com IA" description="Pergunte em português sobre os números da clínica e gere o resumo do mês." backHref="/analitico" backLabel="Painel analítico" />
      <InsightsPanel month={todayIso().slice(0, 7)} summaries={data ?? []} initialQuestion={typeof pergunta === "string" ? pergunta.slice(0, 500) : ""} />
    </div>
  );
}
