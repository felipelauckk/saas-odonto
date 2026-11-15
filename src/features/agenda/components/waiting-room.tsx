"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Row = { id: string; patientName: string; professionalName: string; scheduledTime: string; arrivedAt: string };

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** Quem chegou e está aguardando, com o tempo de espera atualizado a cada minuto. */
export function WaitingRoom({ rows, unitId }: { rows: Row[]; unitId: string }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      void supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`sala-${unitId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `unit_id=eq.${unitId}` }, () => router.refresh())
        .subscribe();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [unitId, router]);

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
