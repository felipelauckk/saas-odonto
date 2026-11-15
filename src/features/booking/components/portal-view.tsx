"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { formatLongDate } from "@/lib/timezone";

type Result = { error?: string };
type Data = {
  appointments: { id: string; date: string; time: string; status: string; type: string | null; professional: string | null; unit: string | null; rescheduleRequested: boolean }[];
  plans: { id: string; status: string; totalCents: number; discountCents: number; installments: number; professional: string | null; items: { description: string; tooth: number | null; priceCents: number; status: string }[] }[];
  receivables: { id: string; description: string; amount_cents: number; due_date: string; status: string; invoiceUrl: string | null }[];
  documents: { id: string; title: string; kind: string; status: string; created_at: string }[];
  hasAnamnesis: boolean;
};
type Actions = {
  confirm: (token: string, id: string) => Promise<Result>;
  reschedule: (token: string, id: string) => Promise<Result>;
  approve: (token: string, id: string) => Promise<Result>;
  pay: (token: string, id: string) => Promise<Result & { url?: string }>;
  sign: (token: string, target: { documentId: string } | { anamnesis: true }) => Promise<Result & { token?: string }>;
};

const br = (d: string) => d.split("-").reverse().join("/");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function PortalView({ token, data, actions }: { token: string; data: Data; actions: Actions }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result & { url?: string; token?: string }>, ok?: string) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) return setMessage({ status: "error", message: r.error });
      if (r.url) return void (window.location.href = r.url);
      if (r.token) return router.push(`/assinar/${r.token}`);
      setMessage(ok ? { status: "success", message: ok } : null);
      router.refresh();
    });

  return (
    <div className="space-y-8">
      {message ? <FormMessage state={message} /> : null}

      <Section title="Próximas consultas">
        {data.appointments.length ? (
          <ul className="space-y-2">
            {data.appointments.map((a) => (
              <li key={a.id} className="space-y-2 rounded-xl border p-4">
                <p className="font-medium first-letter:uppercase">{formatLongDate(a.date)} às {a.time}</p>
                <p className="text-sm text-muted-foreground">{[a.type, a.professional, a.unit].filter(Boolean).join(" · ")}</p>
                <div className="flex flex-wrap gap-2">
                  {a.status === "scheduled" ? <Button size="sm" disabled={pending} onClick={() => run(() => actions.confirm(token, a.id), "Presença confirmada.")}>Confirmar presença</Button> : <Badge variant="secondary">Confirmada</Badge>}
                  {a.rescheduleRequested ? (
                    <Badge variant="outline">Remarcação pedida: a clínica vai entrar em contato</Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => actions.reschedule(token, a.id), "Pedido enviado. A clínica vai entrar em contato para remarcar.")}>Pedir remarcação</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma consulta marcada.</p>
        )}
      </Section>

      {data.plans.length ? (
        <Section title="Orçamentos">
          <ul className="space-y-3">
            {data.plans.map((p) => (
              <li key={p.id} className="space-y-2 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium tabular-nums">{formatCurrency(p.totalCents - p.discountCents)}</span>
                  {p.status === "presented" ? <Badge variant="secondary">Aguardando sua aprovação</Badge> : <Badge>Aprovado</Badge>}
                </div>
                <ul className="divide-y text-sm">
                  {p.items.map((i, idx) => (
                    <li key={idx} className="flex justify-between gap-3 py-1.5">
                      <span>{i.description}{i.tooth ? ` (dente ${i.tooth})` : ""}</span>
                      <span className="tabular-nums">{formatCurrency(i.priceCents)}</span>
                    </li>
                  ))}
                </ul>
                {p.discountCents ? <p className="text-sm text-muted-foreground">Desconto: {formatCurrency(p.discountCents)}</p> : null}
                {p.status === "presented" ? (
                  <>
                    <p className="text-sm text-muted-foreground">{p.installments > 1 ? `Em ${p.installments} parcelas.` : "À vista."} Ao aprovar, as parcelas aparecem abaixo para pagamento.</p>
                    <Button disabled={pending} onClick={() => run(() => actions.approve(token, p.id), "Orçamento aprovado. Obrigado!")}>Aprovar orçamento</Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.receivables.length ? (
        <Section title="Pagamentos em aberto">
          <ul className="divide-y rounded-xl border">
            {data.receivables.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">{r.description}<span className="block text-muted-foreground">Vence {br(r.due_date)}</span></span>
                <span className="font-medium tabular-nums">{formatCurrency(r.amount_cents)}</span>
                <Button size="sm" disabled={pending} onClick={() => run(() => actions.pay(token, r.id))}>Pagar</Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.documents.length || data.hasAnamnesis ? (
        <Section title="Documentos">
          <ul className="divide-y rounded-xl border">
            {data.hasAnamnesis ? (
              <li className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1">Ficha de saúde (anamnese)</span>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => actions.sign(token, { anamnesis: true }))}>Preencher</Button>
              </li>
            ) : null}
            {data.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1">{d.title}<span className="block text-muted-foreground">{br(d.created_at.slice(0, 10))}</span></span>
                {d.status === "signed" ? <Badge variant="secondary">Assinado</Badge> : <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => actions.sign(token, { documentId: d.id }))}>Ler e assinar</Button>}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
