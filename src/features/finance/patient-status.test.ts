import { describe, expect, it } from "vitest";

import { financialStatus, isOverdue, type StatusReceivable } from "./patient-status";

const today = "2026-11-26";
const r = (over: Partial<StatusReceivable>): StatusReceivable => ({ id: "x", description: "Parcela", amount_cents: 10000, due_date: "2026-12-10", status: "open", plan_id: "p1", ...over });

describe("situação financeira do paciente", () => {
  it("sem cobrança", () => {
    expect(financialStatus([], today, null)).toEqual({ kind: "ok", note: "Nenhuma cobrança" });
    expect(financialStatus([r({ status: "canceled" })], today, null)).toEqual({ kind: "ok", note: "Nenhuma cobrança" });
  });

  it("em dia com plano aprovado: conta as parcelas pagas do plano", () => {
    const list = [r({ id: "a", status: "paid" }), r({ id: "b", status: "paid" }), r({ id: "c" }), r({ id: "d", plan_id: "outro" })];
    expect(financialStatus(list, today, "p1")).toEqual({ kind: "ok", note: "Plano aprovado · 2 de 3 parcelas pagas" });
    expect(financialStatus(list, today, null)).toEqual({ kind: "ok", note: "2 de 4 cobranças pagas" });
  });

  it("vencido: overdue ou aberta antes de hoje; a mais antiga é a que se recebe", () => {
    expect(isOverdue({ status: "open", due_date: "2026-11-25" }, today)).toBe(true);
    expect(isOverdue({ status: "open", due_date: today }, today)).toBe(false);
    const list = [r({ id: "new", due_date: "2026-11-20", amount_cents: 5000 }), r({ id: "old", status: "overdue", due_date: "2026-10-20", amount_cents: 12000, description: "Taxa de avaliação" }), r({ id: "future" })];
    const s = financialStatus(list, today, "p1");
    expect(s.kind).toBe("overdue");
    if (s.kind !== "overdue") return;
    expect(s.overdueCents).toBe(17000);
    expect(s.oldest.id).toBe("old");
    expect(s.note.replace(/\s/g, " ")).toBe("2 parcelas vencidas · R$ 170,00");
    const one = financialStatus([list[1]!], today, null);
    expect(one.kind === "overdue" && one.note.replace(/\s/g, " ")).toBe("Taxa de avaliação · R$ 120,00");
  });
});
