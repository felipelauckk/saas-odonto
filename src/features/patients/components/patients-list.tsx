import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import { StatusBadge } from "@/components/app/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ageFromBirthDate, todayIso } from "@/lib/dates";
import { formatPhone } from "@/lib/documents";
import { formatCurrencyWhole } from "@/lib/format";
import { initials } from "@/lib/initials";
import { utcToZoned } from "@/lib/timezone";

import { sourceLabels } from "../labels";
import type { PatientListRow } from "../queries";
import { patientSituation } from "../situation";
import { nextVisitLabel } from "../summary";

/** Colunas da tabela no desktop; no celular cada paciente vira um cartão. */
const GRID = "lg:grid lg:grid-cols-[minmax(0,2.2fr)_4.5rem_6.5rem_minmax(0,1.4fr)_minmax(0,1.3fr)_6.5rem_6rem] lg:items-center lg:gap-4";
const GRID_NO_BALANCE = "lg:grid lg:grid-cols-[minmax(0,2.2fr)_4.5rem_6.5rem_minmax(0,1.4fr)_minmax(0,1.3fr)_6rem] lg:items-center lg:gap-4";

function lastVisit(iso: string | null) {
  if (!iso) return null;
  const date = utcToZoned(iso).date;
  return date === todayIso() ? "Hoje" : date.split("-").reverse().join("/");
}

function Cell({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("text-[0.8125rem]", className)}>
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  );
}

export function PatientsList({ patients, showBalance }: { patients: PatientListRow[]; showBalance: boolean }) {
  const grid = showBalance ? GRID : GRID_NO_BALANCE;
  return (
    <div className="overflow-hidden rounded-card border bg-card">
      <div aria-hidden className={cn("hidden border-b border-border-soft px-5 py-2.5 type-label text-muted-foreground", grid)}>
        <span>Paciente</span>
        <span>Idade</span>
        <span>Última visita</span>
        <span>Próxima consulta</span>
        <span>Situação</span>
        {showBalance ? <span className="text-right">Em aberto</span> : null}
        <span>Origem</span>
      </div>
      <ul className="divide-y divide-border-soft">
        {patients.map((p) => {
          const situation = patientSituation({
            overdueCents: Number(p.overdue_cents),
            returnOverdue: p.return_overdue,
            inTreatment: p.in_treatment,
            openQuote: p.open_quote,
            lastVisitAt: p.last_visit_at,
            nextVisitAt: p.next_visit_at,
          });
          const phone = p.phone ?? p.whatsapp;
          const open = Number(p.open_cents);
          return (
            <li key={p.id}>
              <Link
                href={`/pacientes/${p.id}`}
                className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted sm:px-5", grid)}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-avatar bg-accent text-xs font-bold text-accent-foreground">
                    {initials(p.full_name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{p.full_name}</span>
                    <span className="truncate text-xs text-muted-foreground">{phone ? formatPhone(phone) : "Sem telefone"}</span>
                  </span>
                </span>
                <span className="lg:hidden">
                  <StatusBadge tone={situation.tone}>{situation.label}</StatusBadge>
                </span>
                <Cell label="Idade" className="hidden text-muted-foreground lg:inline">
                  {p.birth_date ? `${ageFromBirthDate(p.birth_date)} anos` : "—"}
                </Cell>
                <Cell label="Última visita" className="hidden tabular-nums lg:inline">
                  {lastVisit(p.last_visit_at) ?? <span className="text-muted-foreground">—</span>}
                </Cell>
                <Cell
                  label="Próxima consulta"
                  className={cn("w-full pl-12 tabular-nums lg:w-auto lg:pl-0", !p.next_visit_at && "hidden text-muted-foreground lg:inline")}
                >
                  <span className="lg:hidden">Próxima: </span>
                  {p.next_visit_at ? nextVisitLabel(p.next_visit_at) : "Sem consulta"}
                </Cell>
                <span className="hidden lg:inline">
                  <StatusBadge tone={situation.tone}>{situation.label}</StatusBadge>
                </span>
                {showBalance ? (
                  <Cell
                    label="Em aberto"
                    className={cn(
                      "hidden text-right tabular-nums lg:inline",
                      open > 0 ? "font-semibold" : "text-muted-foreground",
                      Number(p.overdue_cents) > 0 && "text-destructive",
                    )}
                  >
                    {open > 0 ? formatCurrencyWhole(open) : "—"}
                  </Cell>
                ) : null}
                <Cell label="Origem" className="hidden text-muted-foreground lg:inline">
                  {p.source ? sourceLabels[p.source] : "—"}
                </Cell>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type PaginationProps = { page: number; pages: number; total: number; pageSize: number; hrefFor: (page: number) => string };

const count = new Intl.NumberFormat("pt-BR");

export function Pagination({ page, pages, total, pageSize, hrefFor }: PaginationProps) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[0.8125rem] text-muted-foreground tabular-nums">
        {pages <= 1 ? (total === 1 ? "1 paciente" : `${count.format(total)} pacientes`) : `Mostrando ${count.format(first)}–${count.format(last)} de ${count.format(total)}`}
      </p>
      {pages > 1 ? (
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={buttonVariants({ variant: "outline" })}>
              <ChevronLeft aria-hidden />
              Anterior
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={hrefFor(page + 1)} className={buttonVariants({ variant: "outline" })}>
              Próxima
              <ChevronRight aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
