import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { z } from "zod";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import { CrcBoard } from "@/features/crc/components/crc-board";
import { crcQueues, queueLabels, type CrcQueue } from "@/features/crc/labels";
import { getCrcBoard } from "@/features/crc/queries";
import { requireFrontDesk } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "CRC" };

export default async function Page({ searchParams }: PageProps<"/crc">) {
  const session = await requireFrontDesk();
  const params = await searchParams;
  const today = todayIso();
  const board = await getCrcBoard(today);

  const count = (q: CrcQueue) => board.now.filter((i) => i.queue === q).length;
  const firstWithItems = crcQueues.find((q) => count(q) > 0) ?? crcQueues[0]!;
  const queue = z.enum(crcQueues as [CrcQueue, ...CrcQueue[]]).catch(firstWithItems).parse(params.fila);
  const showingLater = params.ver === "depois";
  const source = showingLater ? board.later : board.now;

  const total = board.now.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="type-display">CRC</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? "Ninguém para contatar hoje." : total === 1 ? "1 paciente para contatar hoje." : `${total} pacientes para contatar hoje.`} Cada um
            sai da fila sozinho quando agenda, aprova ou paga.
          </p>
        </div>
        <Link href="/crc/indicadores" className={buttonVariants({ variant: "outline" })}>
          <BarChart3 aria-hidden />
          Indicadores
        </Link>
      </header>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Filas" className="min-w-0">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-0">
            {crcQueues.map((q) => {
              const on = q === queue;
              return (
                <li key={q} className="shrink-0">
                  <Link
                    href={`/crc?fila=${q}`}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                      on ? "border-brand-deep bg-brand-deep font-semibold text-brand-deep-foreground" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span>{queueLabels[q]}</span>
                    <span
                      className={cn(
                        "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold tabular-nums",
                        on ? "bg-brand-highlight text-brand-deep" : "bg-muted text-foreground",
                      )}
                    >
                      {count(q)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <CrcBoard
          queue={queue}
          items={source.filter((i) => i.queue === queue)}
          laterCount={board.later.filter((i) => i.queue === queue).length}
          showingLater={showingLater}
          template={board.templates[queue] ?? null}
          clinicName={session.clinic.name}
          today={today}
        />
      </div>
    </div>
  );
}
