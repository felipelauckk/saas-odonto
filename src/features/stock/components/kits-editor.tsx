"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { removeKitItem, saveKitItem } from "../actions";
import { formatQty } from "../logic";

type Props = {
  kits: { id: string; procedure_id: string; product_id: string; qty: number }[];
  procedures: { id: string; name: string }[];
  products: { id: string; name: string; measure: string }[];
  canManage: boolean;
};

const select = "h-9 w-full rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11";

export function KitsEditor({ kits, procedures, products, canManage }: Props) {
  const [procedureId, setProcedureId] = useState(procedures.find((p) => kits.some((k) => k.procedure_id === p.id))?.id ?? procedures[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const productById = new Map(products.map((p) => [p.id, p]));
  const items = kits.filter((k) => k.procedure_id === procedureId);
  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      setError(r.error ?? null);
    });

  return (
    <div className="space-y-4">
      <div className="max-w-md space-y-1.5">
        <Label htmlFor="kit-procedure">Procedimento</Label>
        <select id="kit-procedure" className={select} value={procedureId} onChange={(e) => setProcedureId(e.target.value)}>
          {procedures.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {kits.some((k) => k.procedure_id === p.id) ? " (com kit)" : ""}
            </option>
          ))}
        </select>
      </div>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {items.length ? (
        <ul className="divide-y rounded-xl border">
          {items.map((k) => {
            const p = productById.get(k.product_id);
            return (
              <li key={k.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="flex-1">{p?.name ?? "Produto inativo"}</span>
                <span className="tabular-nums">{formatQty(k.qty, p?.measure ?? "")}</span>
                {canManage ? (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remover ${p?.name ?? "item"} do kit`} disabled={pending} onClick={() => run(() => removeKitItem(k.id))}>
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Este procedimento ainda não tem kit.</p>
      )}
      {canManage && procedureId ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="kit-product">Material</Label>
            <select id="kit-product" className={select} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Escolha</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.measure})</option>)}
            </select>
          </div>
          <div className="w-28 space-y-1.5">
            <Label htmlFor="kit-qty">Quantidade</Label>
            <Input id="kit-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <Button variant="outline" disabled={pending} onClick={() => run(() => saveKitItem({ procedureId, productId, qty }))}>Adicionar ao kit</Button>
        </div>
      ) : null}
    </div>
  );
}
