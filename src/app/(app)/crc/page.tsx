import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { z } from "zod";
import { cn } from "cn";

import { PageHeader } from "@/components/layout/page-header";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRC"
        description="Central de relacionamento: quem precisa de contato hoje."
        actions={
          <Link href="/crc/indicadores" className={buttonVariants({ variant: "outline" })}>
            <BarChart3 aria-hidden />
            Indicadores
          </Link>
        }
      />
      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Filas" className="md:w-64 md:shrink-0">
          <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible">
            {crcQueues.map((q) => (
              <li key={q} className="shrink-0">
                <Link
                  href={`/crc?fila=${q}`}
                  aria-current={q === queue ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center justify-between gap-3 rounded-lg border px-3 text-sm transition-colors md:border-transparent pointer-coarse:h-11",
                    q === queue ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span>{queueLabels[q]}</span>
                  <span className="tabular-nums">{count(q)}</span>
                </Link>
              </li>
            ))}
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
