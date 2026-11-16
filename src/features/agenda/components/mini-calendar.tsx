import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import { addDays } from "@/lib/timezone";

import { monthWeeks } from "../overview";

const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });

const LEVEL_CLASS = [
  "bg-card ring-1 ring-inset ring-border-soft",
  "bg-accent text-accent-foreground",
  "bg-primary/40 text-brand-deep",
  "bg-primary text-primary-foreground",
] as const;
const LEVEL_TEXT = ["livre", "pouco ocupado", "ocupado", "quase cheio"] as const;
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

type Props = {
  /** Dia mostrado na agenda (define o mês). */
  date: string;
  today: string;
  levels: Map<string, 0 | 1 | 2 | 3>;
  /** Monta o link de um dia mantendo a visão atual. */
  hrefFor: (date: string) => string;
};

/** Mês com cada dia colorido pela ocupação; clicar abre o dia. */
export function MiniCalendar({ date, today, levels, hrefFor }: Props) {
  const month = date.slice(0, 7);
  const prev = `${addDays(`${month}-01`, -1).slice(0, 7)}-01`;
  const next = `${addDays(`${month}-01`, 31).slice(0, 7)}-01`;
  const title = monthTitle.format(new Date(`${month}-01T00:00:00Z`)).replace(" de ", " ");

  return (
    <section aria-labelledby="mini-cal" className="space-y-3 rounded-card border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mini-cal" className="type-section first-letter:uppercase">
          {title}
        </h2>
        <div className="flex items-center">
          <Link href={hrefFor(prev)} aria-label="Mês anterior" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:size-11">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={hrefFor(next)} aria-label="Próximo mês" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:size-11">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-1 text-center">
        <thead>
          <tr>
            {WEEKDAYS.map((w, i) => (
              <th key={i} scope="col" className="pb-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
                <abbr title={["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][i]} className="no-underline">
                  {w}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month).map((week, i) => (
            <tr key={i}>
              {week.map((day, j) =>
                day ? (
                  <td key={day} className="p-0">
                    <Link
                      href={hrefFor(day)}
                      aria-current={day === date ? "date" : undefined}
                      aria-label={`${dayLabel.format(new Date(`${day}T00:00:00Z`))}${day === today ? ", hoje" : ""}, ${LEVEL_TEXT[levels.get(day) ?? 0]}`}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-xs tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11",
                        LEVEL_CLASS[levels.get(day) ?? 0],
                        day === date && "ring-2 ring-inset ring-foreground",
                        day === today ? "font-bold underline underline-offset-2" : "font-medium",
                      )}
                    >
                      {Number(day.slice(8, 10))}
                    </Link>
                  </td>
                ) : (
                  <td key={`v${j}`} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground" aria-label="Legenda da ocupação">
        {LEVEL_TEXT.map((t, i) => (
          <li key={t} className="flex items-center gap-1">
            <span className={cn("size-2.5 rounded-sm", LEVEL_CLASS[i])} aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}
