/**
 * Contas a pagar no banco: só a gestão, baixa lança saída no caixa com a
 * categoria, conta paga trava, vencida automática, categorias padrão.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("contas a pagar (RLS e baixa)", () => {
  const env = createTestEnv("pagar");
  const admin = env.admin;
  const today = todayIso();

  let owner: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let rentId = "";
  let materialId = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Pagar");
    await env.createUser("outra", "Clínica Outra Pagar");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
    const { data: cats } = await owner.from("finance_categories").select("id, name").eq("type", "expense");
    rentId = cats!.find((c) => c.name === "Aluguel e condomínio")!.id;
    materialId = cats!.find((c) => c.name === "Material odontológico")!.id;
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const bill = (overrides: Record<string, unknown> = {}) => ({
    clinic_id: clinicId,
    unit_id: unitId,
    category_id: rentId,
    description: "Aluguel",
    amount_cents: 300000,
    due_date: today,
    ...overrides,
  });

  it("clínica nova tem categorias de receita e despesa", async () => {
    const { data } = await reception.from("finance_categories").select("type");
    expect(data!.filter((c) => c.type === "income").length).toBeGreaterThanOrEqual(3);
    expect(data!.filter((c) => c.type === "expense").length).toBeGreaterThanOrEqual(10);
  });

  it("recepção não vê nem lança contas a pagar; a gestão sim", async () => {
    const { error } = await reception.from("payables").insert(bill());
    expect(error).not.toBeNull();
    expect((await owner.from("payables").insert(bill()).select("id")).error).toBeNull();
    expect((await reception.from("payables").select("id")).data).toEqual([]);
    expect((await other.from("payables").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
  });

  it("vencimento passado nasce vencida", async () => {
    const { data } = await owner.from("payables").insert(bill({ due_date: addDays(today, -2) })).select("status").single();
    expect(data?.status).toBe("overdue");
  });

  it("baixa lança saída no caixa com categoria; conta paga trava", async () => {
    const { data: p } = await owner.from("payables").insert(bill({ category_id: materialId, description: "Resinas" })).select("id").single();
    const { error } = await owner.rpc("pay_payable", { _payable_id: p!.id, _paid_amount_cents: 290000, _payment_method_id: null as unknown as string, _paid_on: today });
    expect(error).toBeNull();
    const { data: cash } = await owner.from("cash_movements").select("type, amount_cents, category_id").eq("payable_id", p!.id);
    expect(cash).toEqual([{ type: "out", amount_cents: 290000, category_id: materialId }]);

    const { error: edit } = await owner.from("payables").update({ amount_cents: 1 }).eq("id", p!.id);
    expect(edit?.code).toBe("OF007");
    const { error: again } = await owner.rpc("pay_payable", { _payable_id: p!.id, _paid_amount_cents: 1, _payment_method_id: null as unknown as string, _paid_on: today });
    expect(again?.code).toBe("OF001");
    const { error: receptionPays } = await reception.rpc("pay_payable", { _payable_id: p!.id, _paid_amount_cents: 1, _payment_method_id: null as unknown as string, _paid_on: today });
    expect(receptionPays?.code).toBe("42501");
  });

  it("recepção lança saída do caixa com categoria", async () => {
    const { error } = await reception.from("cash_movements").insert({ clinic_id: clinicId, unit_id: unitId, type: "out", amount_cents: 1500, description: "Café", category_id: materialId });
    expect(error).toBeNull();
  });
});
