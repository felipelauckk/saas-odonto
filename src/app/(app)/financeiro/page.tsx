import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { cn } from "cn";
import { z } from "zod";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isOnlineBillingEnabled, listCharges } from "@/features/charges/service";
import { getInvoicesInfo } from "@/features/invoices/queries";
import { NewReceivableButton } from "@/features/finance/components/new-receivable";
import { ReceivablesList } from "@/features/finance/components/receivables-list";
import { RECEIVABLE_FILTERS, type ReceivableFilter } from "@/features/finance/labels";
import { getReceivablesSummary, listActivePaymentMethods, listReceivables } from "@/features/finance/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Financeiro" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export default async function Page({ searchParams }: PageProps<"/financeiro">) {
  const session = await requireClinic();
  const raw = await searchParams;
  const filter = (Object.keys(RECEIVABLE_FILTERS).includes(String(raw.status)) ? raw.status : "pendentes") as ReceivableFilter;
  const from = isoDate.safeParse(raw.de).success ? (raw.de as string) : null;
  const to = isoDate.safeParse(raw.ate).success ? (raw.ate as string) : null;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 80) : "";

  const role = session.clinic.role;
  const canOperate = role !== "dentist";
  const canManage = role === "owner" || role === "manager";

  const [receivables, summary, paymentMethods, onlineEnabled, charges] = await Promise.all([
    listReceivables({ filter, from, to, q }),
    getReceivablesSummary(),
    listActivePaymentMethods(),
    canOperate ? isOnlineBillingEnabled(session.clinic.id) : Promise.resolve(false),
    canOperate ? createClient().then((s) => listCharges(s, { openOnly: true })) : Promise.resolve([]),
  ]);
  const invoicesInfo = canOperate ? await getInvoicesInfo(session.clinic.id, receivables.filter((r) => r.status === "paid").map((r) => r.id)) : undefined;
  const listed = receivables.reduce((s, r) => s + (r.status === "paid" ? (r.paid_amount_cents ?? 0) : r.amount_cents), 0);

  const hrefFor = (status: string) => {
    const qs = new URLSearchParams();
    if (status !== "pendentes") qs.set("status", status);
    if (from) qs.set("de", from);
    if (to) qs.set("ate", to);
    if (q) qs.set("q", q);
    const s = qs.toString();
    return s ? `/financeiro?${s}` : "/financeiro";
  };

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border bg-card p-5 shadow-card">
          <dt className="text-sm text-muted-foreground">A receber (em dia)</dt>
          <dd className="text-2xl font-semibold tabular-nums">{formatCurrency(summary.open)}</dd>
        </div>
        <div className="rounded-card border bg-card p-5 shadow-card">
          <dt className="text-sm text-muted-foreground">Vencido</dt>
          <dd className="text-2xl font-semibold tabular-nums text-destructive">{formatCurrency(summary.overdue)}</dd>
          <dd className="text-xs text-muted-foreground">{summary.overdueCount} {summary.overdueCount === 1 ? "conta" : "contas"}</dd>
        </div>
        <div className="rounded-card border bg-card p-5 shadow-card">
          <dt className="text-sm text-muted-foreground">Total da lista abaixo</dt>
          <dd className="text-2xl font-semibold tabular-nums">{formatCurrency(listed)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <nav className="flex flex-wrap gap-2" aria-label="Situação">
          {(Object.entries(RECEIVABLE_FILTERS) as [ReceivableFilter, { label: string }][]).map(([key, f]) => (
            <Link
              key={key}
              href={hrefFor(key)}
              aria-current={filter === key ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-sm pointer-coarse:h-11",
                filter === key ? "border-foreground bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {canOperate ? <NewReceivableButton /> : null}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        {filter !== "pendentes" ? <input type="hidden" name="status" value={filter} /> : null}
        <div className="space-y-1.5">
          <Label htmlFor="fin-q">Paciente</Label>
          <Input id="fin-q" name="q" defaultValue={q} placeholder="Nome" className="w-48" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fin-de">Vencimento de</Label>
          <Input id="fin-de" name="de" type="date" defaultValue={from ?? ""} className="w-auto" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fin-ate">até</Label>
          <Input id="fin-ate" name="ate" type="date" defaultValue={to ?? ""} className="w-auto" />
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {receivables.length ? (
        <ReceivablesList receivables={receivables} paymentMethods={paymentMethods} canOperate={canOperate} canManage={canManage} online={{ enabled: onlineEnabled, clinicName: session.clinic.name, charges }} invoices={invoicesInfo} />
      ) : (
        <EmptyState icon={Wallet} title="Nenhuma conta encontrada" description="As parcelas dos orçamentos aprovados e as cobranças avulsas aparecem aqui." />
      )}
    </div>
  );
}
