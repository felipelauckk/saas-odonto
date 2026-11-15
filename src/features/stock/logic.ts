import { addDays } from "@/lib/timezone";

export type Lot = { productId: string; unitId: string; qty: number; expiresOn: string | null; unitCostCents: number };
export type Product = { id: string; name: string; measure: string; minQty: number; active: boolean };

/** Saldo por produto (somando os lotes, opcionalmente de uma unidade). */
export function balances(lots: Lot[], unitId: string | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of lots) {
    if (unitId && l.unitId !== unitId) continue;
    map.set(l.productId, round3((map.get(l.productId) ?? 0) + l.qty));
  }
  return map;
}

/** Valor do estoque (custo dos lotes). */
export function stockValueCents(lots: Lot[], unitId: string | null): number {
  return Math.round(lots.filter((l) => !unitId || l.unitId === unitId).reduce((s, l) => s + l.qty * l.unitCostCents, 0));
}

/**
 * Lista de compras: produtos ativos abaixo do mínimo. Sugere repor até o
 * dobro do mínimo.
 */
export function shoppingList(products: Product[], balance: Map<string, number>) {
  return products
    .filter((p) => p.active && p.minQty > 0 && (balance.get(p.id) ?? 0) < p.minQty)
    .map((p) => {
      const current = balance.get(p.id) ?? 0;
      return { product: p, current, suggested: round3(p.minQty * 2 - current) };
    })
    .sort((a, b) => a.current / a.product.minQty - b.current / b.product.minQty);
}

/** Lotes com saldo que vencem até `days` dias (ou já venceram). */
export function expiringLots<T extends Lot>(lots: T[], today: string, days = 60): T[] {
  const limit = addDays(today, days);
  return lots.filter((l) => l.qty > 0 && l.expiresOn && l.expiresOn <= limit).sort((a, b) => (a.expiresOn ?? "").localeCompare(b.expiresOn ?? ""));
}

export function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

const qtyFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
export const formatQty = (n: number, measure: string) => `${qtyFormat.format(n)} ${measure}`;
