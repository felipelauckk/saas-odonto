import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Nota fiscal ligada? E a nota (válida ou com erro) de cada recebimento listado. */
export async function getInvoicesInfo(clinicId: string, receivableIds: string[]) {
  const supabase = await createClient();
  const [{ data: settings }, { data: invoices }] = await Promise.all([
    supabase.from("clinic_fiscal_settings").select("enabled").eq("clinic_id", clinicId).maybeSingle(),
    receivableIds.length
      ? supabase.from("service_invoices").select("receivable_id, status, pdf_url").in("receivable_id", receivableIds.slice(0, 500)).neq("status", "canceled").order("created_at")
      : Promise.resolve({ data: [] as { receivable_id: string | null; status: string; pdf_url: string | null }[] }),
  ]);
  const byReceivable: Record<string, { status: string; pdfUrl: string | null }> = {};
  for (const i of invoices ?? []) if (i.receivable_id) byReceivable[i.receivable_id] = { status: i.status, pdfUrl: i.pdf_url };
  return { enabled: Boolean(settings?.enabled), byReceivable };
}
