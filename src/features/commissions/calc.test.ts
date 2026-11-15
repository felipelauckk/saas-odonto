import { describe, expect, it } from "vitest";

import { computeStatement, netItemValues, type Plan } from "./calc";

const plan: Plan = {
  id: "p1",
  discountCents: 10000, // R$ 100 de desconto
  items: [
    { id: "canal", description: "Canal", procedureId: "proc-canal", category: "Endodontia", priceCents: 60000, labCostCents: 0, status: "done", doneAt: "2030-03-10T12:00:00Z" },
    { id: "coroa", description: "Coroa", procedureId: "proc-coroa", category: "Prótese", priceCents: 40000, labCostCents: 20000, status: "approved", doneAt: null },
    { id: "clareamento", description: "Clareamento", procedureId: null, category: null, priceCents: 30000, labCostCents: 0, status: "rejected", doneAt: null },
  ],
};

describe("netItemValues", () => {
  it("rateia o desconto só entre os aprovados, sem perder centavos", () => {
    const net = netItemValues(plan);
    expect(net.get("canal")).toBe(54000);
    expect(net.get("coroa")).toBe(36000);
    expect(net.has("clareamento")).toBe(false);
    expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(90000);
  });
});

describe("base executado", () => {
  it("usa o item realizado no mês, a regra por categoria e desconta laboratório", () => {
    const result = computeStatement({
      settings: { base: "executed", deductFees: true, deductLab: true },
      defaultPercent: 30,
      rules: [{ procedureId: null, category: "Endodontia", percent: 40, fixedCents: null }],
      plans: [plan],
      payments: [],
      executed: [{ planId: "p1", patientName: "Ana" }],
      month: "2030-03",
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ description: "Canal", grossCents: 54000, baseCents: 54000, rule: "40%", commissionCents: 21600 });
  });
});

describe("base recebido", () => {
  it("rateia o pagamento entre os itens, desconta taxa e laboratório proporcionais", () => {
    const result = computeStatement({
      settings: { base: "received", deductFees: true, deductLab: true },
      defaultPercent: 30,
      rules: [{ procedureId: "proc-coroa", category: null, percent: null, fixedCents: 15000 }],
      plans: [plan],
      payments: [{ id: "r1", date: "2030-03-05", patientName: "Ana", description: "Parcela 1/2", paidCents: 45000, feeCents: 900, planId: "p1" }],
      executed: [],
      month: "2030-03",
    });
    const [canal, coroa] = result.lines;
    // 45000 rateado 54000:36000 → 27000 e 18000; taxa 900 → 540 e 360.
    expect(canal).toMatchObject({ grossCents: 27000, feeCents: 540, labCents: 0, baseCents: 26460, rule: "30%", commissionCents: 7938 });
    // Coroa: metade paga → metade do laboratório (10000) e metade do valor fixo (7500).
    expect(coroa).toMatchObject({ grossCents: 18000, feeCents: 360, labCents: 10000, baseCents: 7640, commissionCents: 7500 });
    expect(result.grossCents).toBe(45000);
    expect(result.commissionCents).toBe(15438);
  });

  it("cobrança sem orçamento usa o percentual padrão; sem descontar taxa se configurado", () => {
    const result = computeStatement({
      settings: { base: "received", deductFees: false, deductLab: false },
      defaultPercent: 25,
      rules: [],
      plans: [],
      payments: [{ id: "r2", date: "2030-03-02", patientName: "Bia", description: "Consulta", paidCents: 20000, feeCents: 500, planId: null }],
      executed: [],
      month: "2030-03",
    });
    expect(result.lines[0]).toMatchObject({ feeCents: 0, baseCents: 20000, rule: "25%", commissionCents: 5000 });
  });
});
