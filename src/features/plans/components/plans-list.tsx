import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/format";

import type { PlanStatus } from "../labels";
import { PlanStatusBadge } from "./plan-status-badge";

type Row = {
  id: string;
  status: PlanStatus;
  total_cents: number;
  discount_cents: number;
  created_at: string;
  patients: { full_name: string } | null;
  professionals: { name: string; color: string } | null;
};

export function PlansList({ plans, showPatient = true }: { plans: Row[]; showPatient?: boolean }) {
  return (
    <ul className="divide-y rounded-xl border">
      {plans.map((p) => (
        <li key={p.id}>
          <Link href={`/orcamentos/${p.id}`} className="flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 sm:px-5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.professionals?.color ?? "#64748b" }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{showPatient ? p.patients?.full_name : `Orçamento de ${formatDate(p.created_at)}`}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {[p.professionals?.name, showPatient ? formatDate(p.created_at) : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <PlanStatusBadge status={p.status} />
            <span className="hidden w-28 text-right text-sm tabular-nums sm:block">{formatCurrency(p.total_cents - p.discount_cents)}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
