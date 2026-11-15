"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Package, Pencil, Plus } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SwitchField } from "@/components/forms/switch-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDateTime } from "@/lib/format";

import { saveProduct, stockOut, stockPurchase, stockTransfer } from "../actions";
import { balances, expiringLots, formatQty, shoppingList, stockValueCents } from "../logic";

type Product = { id: string; name: string; measure: string; category: string | null; minQty: number; active: boolean };
type Lot = { id: string; productId: string; unitId: string; lotCode: string | null; expiresOn: string | null; qty: number; unitCostCents: number };
type Movement = { id: string; unitName: string; productName: string; measure: string; kind: string; qty: number; shortage: number; note: string | null; createdAt: string };

type Props = {
  tab: "saldo" | "validade" | "compras" | "movimentos";
  unitId: string;
  units: { id: string; name: string }[];
  products: Product[];
  lots: Lot[];
  movements: Movement[];
  suppliers: { id: string; name: string }[];
  today: string;
  canManage: boolean;
  canOperate: boolean;
};

const kindLabels: Record<string, string> = {
  purchase: "Entrada",
  manual_out: "Saída",
  transfer_out: "Transferência (saída)",
  transfer_in: "Transferência (entrada)",
  procedure: "Procedimento",
  adjustment: "Ajuste",
};
const br = (d: string) => d.split("-").reverse().join("/");
const select = "h-9 w-full rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11";

function ProductFields({ p, values, errors }: { p?: Product; values?: Record<string, string>; errors?: Partial<Record<string, string[]>> }) {
  return (
    <>
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <FormField label="Nome" name="name" defaultValue={values?.name ?? p?.name ?? ""} errors={errors?.name} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Unidade de medida" name="measure" placeholder="un, cx, ml" defaultValue={values?.measure ?? p?.measure ?? "un"} errors={errors?.measure} />
        <FormField label="Estoque mínimo" name="minQty" inputMode="decimal" defaultValue={values?.minQty ?? (p ? String(p.minQty).replace(".", ",") : "")} errors={errors?.minQty} />
        <FormField label="Categoria" name="category" defaultValue={values?.category ?? p?.category ?? ""} />
      </div>
      <SwitchField name="active" label="Ativo" defaultChecked={p?.active ?? true} />
    </>
  );
}

export function StockView({ tab, unitId, units, products, lots, movements, suppliers, today, canManage, canOperate }: Props) {
  const [dialog, setDialog] = useState<"out" | "transfer" | null>(null);
  const balance = balances(lots, unitId);
  const shopping = shoppingList(products, balance);
  const expiring = expiringLots(lots.filter((l) => l.unitId === unitId), today, 60);
  const productById = new Map(products.map((p) => [p.id, p]));
  const tabs = [
    { key: "saldo", label: "Saldo" },
    { key: "validade", label: `Validade${expiring.length ? ` (${expiring.length})` : ""}` },
    { key: "compras", label: `Lista de compras${shopping.length ? ` (${shopping.length})` : ""}` },
    { key: "movimentos", label: "Movimentos" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {canOperate ? (
          <>
            <FormDialog title="Entrada no estoque" action={stockPurchase} submitLabel="Registrar entrada" trigger={<Button><ArrowDownToLine aria-hidden />Entrada</Button>}>
              {(state) => (
                <>
                  <input type="hidden" name="unitId" value={unitId} />
                  <div className="space-y-1.5">
                    <Label htmlFor="in-product">Produto</Label>
                    <select id="in-product" name="productId" className={select} defaultValue={state.values?.productId ?? ""}>
                      <option value="">Escolha</option>
                      {products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.measure})</option>)}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Quantidade" name="qty" inputMode="decimal" defaultValue={state.values?.qty ?? ""} errors={state.fieldErrors?.qty} />
                    <FormField label="Custo unitário (R$)" name="unitCost" inputMode="decimal" placeholder="0,00" defaultValue={state.values?.unitCost ?? ""} errors={state.fieldErrors?.unitCost} />
                    <FormField label="Lote (opcional)" name="lotCode" defaultValue={state.values?.lotCode ?? ""} />
                    <FormField label="Validade (opcional)" name="expiresOn" type="date" defaultValue={state.values?.expiresOn ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="in-supplier">Fornecedor</Label>
                    <select id="in-supplier" name="supplierId" className={select} defaultValue={state.values?.supplierId ?? "none"}>
                      <option value="none">Não informado</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  {canManage ? (
                    <>
                      <SwitchField name="createPayable" label="Lançar em contas a pagar" description="Quantidade × custo unitário, categoria Material odontológico." />
                      <FormField label="Vencimento da conta" name="dueDate" type="date" defaultValue={state.values?.dueDate ?? today} />
                    </>
                  ) : null}
                </>
              )}
            </FormDialog>
            <Button variant="outline" onClick={() => setDialog("out")}><ArrowUpFromLine aria-hidden />Saída</Button>
            {units.length > 1 ? <Button variant="outline" onClick={() => setDialog("transfer")}><ArrowRightLeft aria-hidden />Transferir</Button> : null}
            <FormDialog title="Novo produto" action={saveProduct} submitLabel="Criar" trigger={<Button variant="outline"><Plus aria-hidden />Produto</Button>}>
              {(state) => <ProductFields values={state.values} errors={state.fieldErrors} />}
            </FormDialog>
          </>
        ) : null}
        <Link href="/estoque/kits" className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline">Kits por procedimento</Link>
      </div>

      <nav aria-label="Seções do estoque" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <Link key={t.key} href={`/estoque?aba=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={cn("shrink-0 border-b-2 px-3 py-2 text-sm", tab === t.key ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "saldo" ? (
        products.length ? (
          <>
            <p className="text-sm text-muted-foreground">Valor em estoque nesta unidade: <span className="font-medium text-foreground tabular-nums">{formatCurrency(stockValueCents(lots, unitId))}</span></p>
            <ul className="divide-y rounded-xl border">
              {products.map((p) => {
                const qty = balance.get(p.id) ?? 0;
                const low = p.active && p.minQty > 0 && qty < p.minQty;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-muted-foreground">{[p.category, p.minQty ? `mínimo ${formatQty(p.minQty, p.measure)}` : null].filter(Boolean).join(" · ")}</p>
                    </div>
                    {!p.active ? <Badge variant="secondary">Inativo</Badge> : null}
                    {low ? <Badge variant="destructive">Abaixo do mínimo</Badge> : null}
                    <span className="tabular-nums">{formatQty(qty, p.measure)}</span>
                    {canOperate ? (
                      <FormDialog title="Editar produto" action={saveProduct} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`}><Pencil /></Button>}>
                        {(state) => <ProductFields p={p} values={state.values} errors={state.fieldErrors} />}
                      </FormDialog>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <EmptyState icon={Package} title="Nenhum produto" description="Cadastre os materiais que a clínica controla." />
        )
      ) : null}

      {tab === "validade" ? (
        expiring.length ? (
          <ul className="divide-y rounded-xl border">
            {expiring.map((l) => {
              const p = productById.get(l.productId);
              const expired = l.expiresOn! < today;
              return (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                  <span className="flex-1">{p?.name}{l.lotCode ? <span className="text-muted-foreground"> · lote {l.lotCode}</span> : null}</span>
                  <span className="tabular-nums">{formatQty(l.qty, p?.measure ?? "")}</span>
                  <Badge variant={expired ? "destructive" : "secondary"}>{expired ? "Vencido em" : "Vence em"} {br(l.expiresOn!)}</Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Package} title="Nada vencendo nos próximos 60 dias" />
        )
      ) : null}

      {tab === "compras" ? (
        shopping.length ? (
          <ul className="divide-y rounded-xl border">
            {shopping.map((s) => (
              <li key={s.product.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                <span className="flex-1">{s.product.name}<span className="text-muted-foreground"> · tem {formatQty(s.current, s.product.measure)}, mínimo {formatQty(s.product.minQty, s.product.measure)}</span></span>
                <span className="font-medium tabular-nums">Comprar {formatQty(s.suggested, s.product.measure)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Package} title="Nada abaixo do mínimo" />
        )
      ) : null}

      {tab === "movimentos" ? (
        movements.length ? (
          <ul className="divide-y rounded-xl border">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <span className="flex-1">
                  {m.productName}
                  <span className="text-muted-foreground"> · {kindLabels[m.kind]}{units.length > 1 ? ` · ${m.unitName}` : ""}{m.note ? ` · ${m.note}` : ""}</span>
                  {m.shortage ? <span className="text-destructive"> · faltou {formatQty(m.shortage, m.measure)}</span> : null}
                </span>
                <span className={cn("tabular-nums", m.qty < 0 ? "text-destructive" : "")}>{m.qty > 0 ? "+" : ""}{formatQty(m.qty, m.measure)}</span>
                <span className="text-muted-foreground tabular-nums">{formatDateTime(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Package} title="Nenhum movimento ainda" />
        )
      ) : null}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog === "out" ? "Saída do estoque" : "Transferir entre unidades"}</DialogTitle></DialogHeader>
          {dialog ? <MoveForm mode={dialog} unitId={unitId} units={units} products={products.filter((p) => p.active)} onDone={() => setDialog(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoveForm({ mode, unitId, units, products, onDone }: { mode: "out" | "transfer"; unitId: string; units: Props["units"]; products: Product[]; onDone: () => void }) {
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [toUnit, setToUnit] = useState(units.find((u) => u.id !== unitId)?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="mv-product">Produto</Label>
        <select id="mv-product" className={select} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Escolha</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.measure})</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mv-qty">Quantidade</Label>
        <Input id="mv-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      {mode === "out" ? (
        <div className="space-y-1.5">
          <Label htmlFor="mv-note">Motivo (opcional)</Label>
          <Input id="mv-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: uso geral, perda, vencido" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="mv-to">Para a unidade</Label>
          <select id="mv-to" className={select} value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
            {units.filter((u) => u.id !== unitId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Sai primeiro o lote que vence antes.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = mode === "out" ? await stockOut({ unitId, productId, qty, note }) : await stockTransfer({ fromUnit: unitId, toUnit, productId, qty });
              if (r.error) setError(r.error);
              else onDone();
            })
          }
        >
          {mode === "out" ? "Registrar saída" : "Transferir"}
        </Button>
      </div>
    </div>
  );
}
