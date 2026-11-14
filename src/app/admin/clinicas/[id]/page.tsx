import { notFound } from "next/navigation";
import { z } from "zod";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { ClinicAdminActions } from "@/features/admin/components/clinic-admin-actions";
import { getClinicForAdmin, listPlansForAdmin } from "@/features/admin/queries";
import { subscriptionStatusLabels } from "@/features/billing/labels";
import { formatCpfCnpj } from "@/lib/documents";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Clínica" };

export default async function Page({ params }: PageProps<"/admin/clinicas/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [data, plans] = await Promise.all([getClinicForAdmin(id), listPlansForAdmin()]);
  if (!data) notFound();
  const { clinic, events, ownerEmails } = data;

  const item = (label: string, value: string | null) => (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );

  return (
    <div className="space-y-8">
      <SubpageHeader title={clinic.name} backHref="/admin" backLabel="Clínicas" />
      <dl className="grid gap-4 rounded-xl border p-5 sm:grid-cols-3">
        {item("Situação", subscriptionStatusLabels[clinic.subscription_status] ?? clinic.subscription_status)}
        {item("Teste até", clinic.trial_ends_at ? formatDate(clinic.trial_ends_at) : null)}
        {item("Em atraso desde", clinic.past_due_since ? formatDate(clinic.past_due_since) : null)}
        {item("Proprietário", ownerEmails.join(", "))}
        {item("Documento", clinic.document_cnpj_cpf ? formatCpfCnpj(clinic.document_cnpj_cpf) : null)}
        {item("Cliente Asaas", clinic.asaas_customer_id)}
        {item("Assinatura Asaas", clinic.asaas_subscription_id)}
        {item("Cadastro", formatDate(clinic.created_at))}
      </dl>
      <section className="space-y-3 rounded-xl border p-5" aria-labelledby="ajustes">
        <h2 id="ajustes" className="text-base font-medium">Ajustes</h2>
        <ClinicAdminActions clinicId={clinic.id} planId={clinic.plan_id} plans={plans.map((p) => ({ id: p.id, name: p.name }))} />
      </section>
      <section className="space-y-2" aria-labelledby="eventos">
        <h2 id="eventos" className="text-sm font-medium text-muted-foreground">Eventos de cobrança</h2>
        {events.length ? (
          <ul className="divide-y rounded-xl border text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between px-4 py-2.5">
                <span>{e.event}</span>
                <span className="text-muted-foreground">{formatDateTime(e.received_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum evento recebido do Asaas.</p>
        )}
      </section>
    </div>
  );
}
