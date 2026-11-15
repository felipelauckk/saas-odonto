import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { ReturnsList } from "@/features/agenda/components/returns-list";
import { requireClinic } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/timezone";

export const metadata: Metadata = { title: "Retornos" };

export default async function Page() {
  await requireClinic();
  const today = todayIso();
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_returns")
    .select("id, patient_id, reason, due_date, notified_at, patients(full_name, whatsapp, phone), professionals(name)")
    .eq("status", "pending")
    .lte("due_date", addDays(today, 30))
    .order("due_date");
  return (
    <div className="space-y-6">
      <SubpageHeader title="Retornos" description="Vencidos e a vencer nos próximos 30 dias. Saem da lista quando o paciente marca nova consulta; no vencimento, o WhatsApp avisa o paciente." backHref="/agenda" backLabel="Agenda" />
      {data?.length ? <ReturnsList rows={data} today={today} /> : <EmptyState icon={CalendarCheck} title="Nenhum retorno pendente" description="Ao concluir uma consulta, defina o retorno (ex.: limpeza em 6 meses)." />}
    </div>
  );
}
