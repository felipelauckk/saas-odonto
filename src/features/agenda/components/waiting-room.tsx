"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Row = { id: string; patientName: string; professionalName: string; scheduledTime: string; arrivedAt: string; isFirstVisit?: boolean };

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** Quem chegou e está aguardando, com o tempo de espera atualizado a cada minuto. */
export function WaitingRoom({ rows, unitId, compact = false }: { rows: Row[]; unitId: string; compact?: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    // Na agenda (compacta), a própria agenda já atualiza a tela em tempo real.
    const supabase = compact ? null : createClient();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let cancelled = false;
    void supabase?.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      void supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`sala-${unitId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `unit_id=eq.${unitId}` }, () => router.refresh())
        .subscribe();
    });
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [unitId, router, compact]);

  if (compact) {
    if (!rows.length) return <p className="py-2 text-sm text-muted-foreground">Ninguém aguardando agora.</p>;
    return (
      <ul>
        {rows.map((r) => {
          const wait = now === null ? null : minutesSince(r.arrivedAt, now);
          return (
            <li key={r.id} className="flex min-h-12 items-center justify-between gap-3 border-t border-border-soft py-1.5 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{r.patientName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[r.professionalName, r.scheduledTime, r.isFirstVisit ? "primeira vez" : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${wait !== null && wait >= 15 ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"}`}
              >
                <span className="sr-only">Esperando há </span>
                {wait === null ? "—" : wait < 1 ? "agora" : `${wait} min`}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (!rows.length) return <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">Ninguém aguardando agora.</p>;
  return (
    <ul className="divide-y rounded-xl border">
      {rows.map((r) => {
        const wait = now === null ? null : minutesSince(r.arrivedAt, now);
        return (
          <li key={r.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.patientName}</p>
              <p className="text-sm text-muted-foreground">{r.professionalName} · marcado para {r.scheduledTime}</p>
            </div>
            <p className={`text-right text-sm font-medium tabular-nums ${wait !== null && wait >= 20 ? "text-destructive" : ""}`} aria-label="Tempo de espera">
              {wait === null ? "—" : wait < 1 ? "agora" : `${wait} min`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
