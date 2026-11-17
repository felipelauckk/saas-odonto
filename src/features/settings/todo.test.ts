import { describe, expect, it } from "vitest";

import { settingsTodo } from "./todo";

const ok = { units: 1, chairs: 2, professionals: 2, procedures: 30, paymentMethods: 4, unpriced: 0 };

describe("settingsTodo", () => {
  it("fica vazio quando está tudo configurado", () => {
    expect(settingsTodo(ok, { planId: "p", status: "active", trialEndsAt: null })).toEqual([]);
  });

  it("lista cadastros faltando com o link de cada um", () => {
    const todo = settingsTodo({ ...ok, chairs: 0, unpriced: 1 }, null);
    expect(todo).toEqual([
      { text: "Nenhuma cadeira cadastrada", href: "/configuracoes/cadeiras" },
      { text: "1 procedimento sem preço", href: "/configuracoes/procedimentos" },
    ]);
    expect(settingsTodo({ ...ok, unpriced: 32 }, null)[0]?.text).toBe("32 procedimentos sem preço");
  });

  it("pede um plano no teste grátis e avisa atraso primeiro", () => {
    expect(settingsTodo(ok, { planId: null, status: "trialing", trialEndsAt: "2026-11-30T12:00:00Z" })[0]?.text).toBe(
      "Escolha um plano: o teste grátis vai até 30/11",
    );
    expect(settingsTodo(ok, { planId: "p", status: "trialing", trialEndsAt: null })).toEqual([]);
    expect(settingsTodo(ok, { planId: "p", status: "past_due", trialEndsAt: null })[0]?.href).toBe("/configuracoes/assinatura");
  });
});
