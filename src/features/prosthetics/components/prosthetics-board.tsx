"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { toWhatsAppNumber } from "@/lib/messaging/render";

import { deliverAligners, launchLabPayable, moveOrder } from "../actions";
import { boardStages, kindLabels, stageLabels, type ProstheticStage } from "../labels";
import { alignerStatus, isLabLate } from "../logic";
import type { ProstheticOrder } from "../queries";
import { OrderForm, type OrderOptions } from "./order-form";

const br = (d: string) => d.split("-").reverse().join("/");

type Props = { orders: ProstheticOrder[]; options: OrderOptions; today: string; canManage: boolean };

export function ProstheticsBoard({ orders, options, today, canManage }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ kind: "new" } | { kind: "edit" | "view"; id: string } | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | "prosthesis" | "aligner">("all");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const visible = orders.filter((o) => kindFilter === "all" || o.kind === kindFilter);
  const selected = dialog && dialog.kind !== "new" ? orders.find((o) => o.id === dialog.id) : null;
  const late = orders.filter((o) => isLabLate(o, today)).length;
  const alignersDue = orders.filter((o) => alignerStatus(o, today)?.needsDelivery).length;

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "prosthesis", "aligner"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kindFilter === k} onClick={() => setKindFilter(k)}
            className={cn("h-8 rounded-full border px-3 text-sm pointer-coarse:h-11", kindFilter === k ? "border-foreground bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted")}>
            {k === "all" ? "Todas" : kindLabels[k]}
          </button>
        ))}
        {late ? <Badge variant="destructive">{late} {late === 1 ? "atrasada no laboratório" : "atrasadas no laboratório"}</Badge> : null}
        {alignersDue ? <Badge variant="secondary">{alignersDue} com placas para entregar</Badge> : null}
        <Button className="ml-auto" onClick={() => setDialog({ kind: "new" })}><Plus aria-hidden />Nova ordem</Button>
      </div>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      {/* Celular: desliza de lado (sem barra). Do tablet para cima: colunas quebram de linha, sem rolagem. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] sm:items-start">
          {boardStages.map((stage) => {
            const column = visible.filter((o) => o.stage === stage);
            return (
              <section
                key={stage}
                aria-label={`${stageLabels[stage]}, ${column.length} ordens`}
                className={cn("flex w-64 shrink-0 flex-col gap-2 sm:w-auto rounded-xl border bg-muted/30 p-2", dragOver === stage && "ring-2 ring-primary")}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage); }}
                onDragLeave={() => setDragOver((v) => (v === stage ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id && orders.find((o) => o.id === id)?.stage !== stage) run(() => moveOrder(id, stage));
                }}
              >
                <h2 className="flex items-center justify-between px-1 text-sm font-medium">
                  <span>{stageLabels[stage]}</span>
                  <span className="tabular-nums text-muted-foreground">{column.length}</span>
                </h2>
                {column.map((o) => {
                  const lateLab = isLabLate(o, today);
                  const aligner = alignerStatus(o, today);
                  return (
                    <button key={o.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)} onClick={() => setDialog({ kind: "view", id: o.id })}
                      className="space-y-1 rounded-lg border bg-background p-3 text-left text-sm hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                      <span className="block font-medium">{o.patientName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[o.workType, o.teeth.length ? `dentes ${o.teeth.join(", ")}` : null, o.labName].filter(Boolean).join(" · ")}
                      </span>
                      {o.expectedReturnOn && (o.stage === "impression" || o.stage === "sent") ? (
                        <span className={cn("block text-xs", lateLab ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {lateLab ? "Atrasado: " : "Retorno previsto "}{br(o.expectedReturnOn)}
                        </span>
                      ) : null}
                      {aligner ? (
                        <span className={cn("block text-xs", aligner.needsDelivery ? "font-medium text-amber-700 dark:text-amber-500" : "text-muted-foreground")}>
                          {aligner.finished ? `Todas as ${o.alignerTotal} placas entregues` : `${o.alignersDelivered}/${o.alignerTotal} placas · acabam em ${br(aligner.runsOutOn)}`}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          {dialog?.kind === "new" ? (
            <>
              <DialogHeader><DialogTitle>Nova ordem protética</DialogTitle></DialogHeader>
              <OrderForm options={options} today={today} onDone={() => { setDialog(null); router.refresh(); }} />
            </>
          ) : selected && dialog?.kind === "edit" ? (
            <>
              <DialogHeader><DialogTitle>Editar ordem</DialogTitle></DialogHeader>
              <OrderForm order={selected} options={options} today={today} onDone={() => setDialog({ kind: "view", id: selected.id })} />
            </>
          ) : selected ? (
            <OrderDetails order={selected} today={today} canManage={canManage} pending={pending} onEdit={() => setDialog({ kind: "edit", id: selected.id })} run={run} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDetails({ order: o, today, canManage, pending, onEdit, run }: { order: ProstheticOrder; today: string; canManage: boolean; pending: boolean; onEdit: () => void; run: (fn: () => Promise<{ error?: string }>) => void }) {
  const [count, setCount] = useState("2");
  const aligner = alignerStatus(o, today);
  const wa = toWhatsAppNumber(o.labPhone);
  const labText = `Olá! Sobre o trabalho de ${o.patientName}: ${o.workType}${o.teeth.length ? `, dentes ${o.teeth.join(", ")}` : ""}${o.shade ? `, cor ${o.shade}` : ""}.`;
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{o.workType}</DialogTitle>
      </DialogHeader>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Paciente</dt>
        <dd><Link href={`/pacientes/${o.patientId}`} className="hover:underline">{o.patientName}</Link></dd>
        {o.labName ? (<><dt className="text-muted-foreground">Laboratório</dt><dd>{o.labName}</dd></>) : null}
        {o.teeth.length ? (<><dt className="text-muted-foreground">Dentes</dt><dd>{o.teeth.join(", ")}</dd></>) : null}
        {o.shade || o.material ? (<><dt className="text-muted-foreground">Cor / material</dt><dd>{[o.shade, o.material].filter(Boolean).join(" · ")}</dd></>) : null}
        {o.sentOn ? (<><dt className="text-muted-foreground">Enviado em</dt><dd>{br(o.sentOn)}</dd></>) : null}
        {o.expectedReturnOn ? (<><dt className="text-muted-foreground">Retorno previsto</dt><dd className={isLabLate(o, today) ? "font-medium text-destructive" : ""}>{br(o.expectedReturnOn)}</dd></>) : null}
        {o.returnedOn ? (<><dt className="text-muted-foreground">Voltou em</dt><dd>{br(o.returnedOn)}</dd></>) : null}
        <dt className="text-muted-foreground">Custo</dt>
        <dd className="tabular-nums">{formatCurrency(o.costCents)}{o.payableId ? " · lançado em contas a pagar" : ""}</dd>
        {o.planItemLabel ? (<><dt className="text-muted-foreground">Item do orçamento</dt><dd>{o.planItemLabel}</dd></>) : null}
      </dl>
      {o.notes ? <p className="whitespace-pre-line text-sm">{o.notes}</p> : null}

      {aligner || o.kind === "aligner" ? (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">Alinhadores: {o.alignersDelivered} de {o.alignerTotal} placas entregues · troca a cada {o.alignerChangeDays} dias</p>
          {aligner ? <p className={aligner.needsDelivery ? "text-amber-700 dark:text-amber-500" : "text-muted-foreground"}>{aligner.finished ? `Tratamento previsto até ${br(aligner.endsOn)}.` : `Placas entregues duram até ${br(aligner.runsOutOn)} (placa ${aligner.currentAligner} hoje).`}</p> : null}
          {o.alignersDelivered < (o.alignerTotal ?? 0) ? (
            <div className="flex items-end gap-2">
              <Input aria-label="Placas entregues agora" inputMode="numeric" className="w-20" value={count} onChange={(e) => setCount(e.target.value)} />
              <Button size="sm" disabled={pending} onClick={() => run(() => deliverAligners(o.id, Number(count)))}>Registrar entrega de placas</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-sm font-medium" id="po-stage">Etapa</p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="po-stage">
          {(["impression", "sent", "try_in", "adjustment", "ready", "delivered", "canceled"] as ProstheticStage[]).map((s) => (
            <button key={s} type="button" disabled={pending} aria-pressed={o.stage === s} onClick={() => o.stage !== s && run(() => moveOrder(o.id, s))}
              className={cn("h-8 rounded-full border px-3 text-sm disabled:opacity-60 pointer-coarse:h-11", o.stage === s ? (s === "canceled" ? "border-destructive bg-destructive/10 text-destructive" : "border-primary bg-primary text-primary-foreground") : "hover:bg-muted")}>
              {stageLabels[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(labText)}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MessageCircle aria-hidden />
            WhatsApp do laboratório
          </a>
        ) : null}
        {canManage && !o.payableId && o.costCents > 0 && o.labName ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => launchLabPayable(o.id))}>Lançar em contas a pagar</Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>
      </div>
    </div>
  );
}
