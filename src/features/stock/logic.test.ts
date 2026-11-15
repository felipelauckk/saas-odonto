import { describe, expect, it } from "vitest";

import { balances, expiringLots, shoppingList, stockValueCents, type Lot } from "./logic";

const lots: Lot[] = [
  { productId: "luva", unitId: "a", qty: 3, expiresOn: "2027-01-01", unitCostCents: 100 },
  { productId: "luva", unitId: "b", qty: 2, expiresOn: null, unitCostCents: 150 },
  { productId: "resina", unitId: "a", qty: 0.5, expiresOn: "2026-12-01", unitCostCents: 4000 },
  { productId: "resina", unitId: "a", qty: 0, expiresOn: "2026-11-20", unitCostCents: 4000 },
];
const products = [
  { id: "luva", name: "Luva", measure: "cx", minQty: 4, active: true },
  { id: "resina", name: "Resina", measure: "un", minQty: 1, active: true },
  { id: "fio", name: "Fio", measure: "un", minQty: 0, active: true },
];

describe("estoque", () => {
  it("saldo por unidade e geral, e valor", () => {
    expect(balances(lots, "a").get("luva")).toBe(3);
    expect(balances(lots, null).get("luva")).toBe(5);
    expect(stockValueCents(lots, "a")).toBe(300 + 2000);
  });

  it("lista de compras: abaixo do mínimo, repõe até o dobro", () => {
    const list = shoppingList(products, balances(lots, "a"));
    expect(list.map((i) => [i.product.id, i.suggested])).toEqual([["resina", 1.5], ["luva", 5]]);
  });

  it("validade: só lotes com saldo que vencem no prazo", () => {
    expect(expiringLots(lots, "2026-11-15", 30).map((l) => l.expiresOn)).toEqual(["2026-12-01"]);
    expect(expiringLots(lots, "2026-11-15", 60).map((l) => l.expiresOn)).toEqual(["2026-12-01", "2027-01-01"]);
  });
});
