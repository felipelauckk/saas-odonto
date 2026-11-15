import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { InvoicesList, type InvoiceRow } from "@/features/invoices/components/invoices-list";
import { invoiceStatusLabels } from "@/features/invoices/logic";
import { PeriodFilter } from "@/features/payables/components/period-filter";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addDays, zonedToUtc } from "@/lib/timezone";

export const metadata: Metadata = { title: "Notas fiscais" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export default async function Page({ searchParams }: PageProps<"/financeiro/notas">) {
  const session = await requireClinic();
  if (session.clinic.role === "dentist") redirect("/financeiro");
  const params = await searchParams;
  const today = todayIso();
  const to = isoDate.catch(today).parse(params.ate);
  const from = isoDate.catch(`${today.slice(0, 7)}-01`).parse(params.de);
  const status = z.enum(["processing", "authorized", "canceled", "error"]).nullable().catch(null).parse(params.situacao || null);
  const supabase = await createClient();
  let q = supabase
    .from("service_invoices")
    .select("id, status, number, amount_cents, description, pdf_url, error, created_at, issued_at, patient_id, patients(full_name, whatsapp, phone)")
    .gte("created_at", zonedToUtc(from, "00:00").toISOString())
    .lt("created_at", zonedToUtc(addDays(to, 1), "00:00").toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const invoices = (data ?? []) as InvoiceRow[];
  const total = invoices.filter((n) => n.status === "authorized").reduce((s, n) => s + n.amount_cents, 0);
  return (
    <div className="space-y-6">
      <PeriodFilter
        fields={[{ name: "de", label: "De", type: "date", value: from }, { name: "ate", label: "Até", type: "date", value: to }]}
        selects={[{ name: "situacao", label: "Situação", value: status ?? "", options: [{ value: "", label: "Todas" }, ...Object.entries(invoiceStatusLabels).map(([value, label]) => ({ value, label }))] }]}
      />
      <p className="text-sm text-muted-foreground">Emitidas no período: <span className="font-medium text-foreground tabular-nums">{formatCurrency(total)}</span></p>
      <InvoicesList invoices={invoices} clinicName={session.clinic.name} canManage={canManageClinic(session.clinic.role)} />
    </div>
  );
}
