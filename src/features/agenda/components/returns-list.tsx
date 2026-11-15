"use client";

import { useTransition } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";

import { setReturnStatus } from "../actions";

type Row = { id: string; patient_id: string; reason: string; due_date: string; notified_at: string | null; patients: { full_name: string; whatsapp: string | null; phone: string | null } | null; professionals: { name: string } | null };

export function ReturnsList({ rows, today }: { rows: Row[]; today: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <ul className="divide-y rounded-xl border">
      {rows.map((r) => {
        const phone = r.patients?.whatsapp ?? r.patients?.phone;
        const overdue = r.due_date < today;
        return (
          <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <Link href={`/pacientes/${r.patient_id}/agendamentos`} className="font-medium hover:underline">{r.patients?.full_name}</Link>
              <p className="text-sm text-muted-foreground">
                {r.reason} · {r.professionals?.name ?? "—"} · {overdue ? "venceu" : "vence"} em {formatIsoDate(r.due_date)}
                {r.notified_at ? ` · avisado em ${formatDate(r.notified_at)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={overdue ? "destructive" : "secondary"}>{overdue ? "Vencido" : "A vencer"}</Badge>
              {phone ? <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>WhatsApp</a> : null}
              <Link href="/agenda" className={buttonVariants({ size: "sm" })}>Agendar</Link>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { await setReturnStatus(r.id, "dismissed"); })}>Dispensar</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
