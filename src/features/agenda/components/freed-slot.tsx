"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { minutesToTime } from "@/lib/timezone";

import { fillFromWaitlist } from "../actions";

type Props = {
  slot: { id: string; date: string; startMin: number; endMin: number };
  professionalName: string;
  matches: { id: string; patientName: string; notes: string | null }[];
  /** "segunda, 16 nov" */
  dayLabel: string;
};

/** Horário que vagou por desmarcação, com quem da lista de espera cabe nele. */
export function FreedSlot({ slot, professionalName, matches, dayLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <section aria-labelledby="vaga" className="space-y-3 rounded-card bg-hero p-4 text-white shadow-card">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-white" strokeWidth={1.75} aria-hidden />
        <h2 id="vaga" className="type-section">
          Vaga {dayLabel}, {minutesToTime(slot.startMin)}, {professionalName}
        </h2>
      </div>
      <p className="text-[0.8125rem] leading-relaxed text-white/90">
        Uma consulta foi desmarcada e o horário continua livre. Da lista de espera, cabem nele:
      </p>
      {done ? (
        <p role="status" className="text-sm font-semibold text-white">
          Pronto: {done} ficou com o horário das {minutesToTime(slot.startMin)}.
        </p>
      ) : (
        <ul>
          {matches.map((m) => (
            <li key={m.id} className="flex min-h-11 items-center justify-between gap-2 border-t border-white/20 py-1.5">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{m.patientName}</span>
                {m.notes ? <span className="truncate text-xs text-white/85">{m.notes}</span> : null}
              </span>
              <button
                type="button"
                disabled={pending}
                aria-label={`Agendar ${m.patientName} às ${minutesToTime(slot.startMin)}`}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const r = await fillFromWaitlist(m.id, slot.id);
                    if (r.error) setError(r.error);
                    else {
                      setDone(m.patientName);
                      router.refresh();
                    }
                  })
                }
                className="inline-flex h-8 shrink-0 items-center rounded-lg bg-white px-3 text-[0.8125rem] font-semibold text-accent-foreground outline-none hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/60 disabled:opacity-60 pointer-coarse:h-11"
              >
                Agendar
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-white underline">
          {error}
        </p>
      ) : null}
    </section>
  );
}
