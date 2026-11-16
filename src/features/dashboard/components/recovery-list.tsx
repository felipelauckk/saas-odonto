import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { queueLabels, type CrcQueue } from "@/features/crc/labels";
import { PressureBar } from "@/components/app/pressure-bar";
import { formatCurrency } from "@/lib/format";

import { BlockEmpty } from "./dashboard-card";

type QueueSummary = { queue: CrcQueue; count: number; amountCents: number; oldestDays: number | null };

function detail(q: QueueSummary) {
  const parts: string[] = [];
  if (q.amountCents > 0) parts.push(formatCurrency(q.amountCents));
  if (q.oldestDays !== null && q.oldestDays > 0) parts.push(`o mais antigo há ${q.oldestDays} ${q.oldestDays === 1 ? "dia" : "dias"}`);
  return parts.join(" · ");
}

/** Filas da CRC com contagem e barra de pressão (tempo parado do item mais antigo). */
export function RecoveryList({ queues }: { queues: QueueSummary[] }) {
  if (!queues.length) return <BlockEmpty>Nada para recuperar agora.</BlockEmpty>;

  return (
    <ul className="-mt-1 flex flex-col">
      {queues.map((q) => (
        <li key={q.queue} className="border-t border-border-soft first:border-t-0">
          <Link
            href={`/crc?fila=${q.queue}`}
            className="grid min-h-13 grid-cols-[0.25rem_minmax(0,1fr)_auto_1rem] items-center gap-3 rounded-md py-1.5 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PressureBar days={q.oldestDays ?? 0} className="h-7 self-center" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{queueLabels[q.queue]}</span>
              {detail(q) ? <span className="truncate text-xs text-muted-foreground">{detail(q)}</span> : null}
            </span>
            <span className="text-sm font-semibold tabular-nums">{q.count}</span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
