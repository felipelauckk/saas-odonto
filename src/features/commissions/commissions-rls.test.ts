/**
 * Comissões no banco: gestão configura; dentista lê só as próprias regras e
 * fechamentos; custo de laboratório só a gestão, mesmo com orçamento aprovado.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("comissões (RLS)", () => {
  const env = createTestEnv("comissoes");
  const admin = env.admin;
  let owner: Client;
  let dentist: Client;
  let clinicId = "";
  let drAna = "";
  let drBeto = "";
  let itemId = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Comissões");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    const member = await env.addMember(clinicId, dentistUser.userId, "dentist");
    const { data: pros } = await admin.from("professionals").insert([{ clinic_id: clinicId, name: "Dra. Ana", member_id: member }, { clinic_id: clinicId, name: "Dr. Beto" }]).select("id, name");
    drAna = pros!.find((p) => p.name === "Dra. Ana")!.id;
    drBeto = pros!.find((p) => p.name === "Dr. Beto")!.id;
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    const { data: patient } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Comissão" }).select("id").single();
    const { data: plan } = await admin.from("treatment_plans").insert({ clinic_id: clinicId, unit_id: unit!.id, patient_id: patient!.id, professional_id: drAna }).select("id").single();
    const { data: item } = await admin.from("treatment_items").insert({ clinic_id: clinicId, plan_id: plan!.id, description: "Coroa", price_cents: 100000, faces: [] }).select("id").single();
    itemId = item!.id;
    await admin.from("treatment_plans").update({ status: "approved" }).eq("id", plan!.id);
    await admin.from("treatment_items").update({ status: "approved" }).eq("id", itemId);
    await admin.from("commission_rules").insert([
      { clinic_id: clinicId, professional_id: drAna, category: "Prótese", percent: 40 },
      { clinic_id: clinicId, professional_id: drBeto, category: "Prótese", percent: 50 },
    ]);
    owner = await env.signIn("owner");
    dentist = await env.signIn("dentista");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("dentista lê só as próprias regras e não cria", async () => {
    const { data } = await dentist.from("commission_rules").select("professional_id");
    expect(data?.map((r) => r.professional_id)).toEqual([drAna]);
    const { error } = await dentist.from("commission_rules").insert({ clinic_id: clinicId, professional_id: drAna, category: "Outros", percent: 99 });
    expect(error).not.toBeNull();
    const { error: percent } = await dentist.from("professionals").update({ commission_percent: 99 }).eq("id", drAna);
    const { data: check } = await admin.from("professionals").select("commission_percent").eq("id", drAna).single();
    expect(percent !== null || check?.commission_percent === null).toBe(true);
  });

  it("custo de laboratório: dentista não, gestão sim mesmo com orçamento aprovado", async () => {
    const { error } = await dentist.from("treatment_items").update({ lab_cost_cents: 5000 }).eq("id", itemId);
    expect(error).not.toBeNull();
    const { error: ownerError } = await owner.from("treatment_items").update({ lab_cost_cents: 30000 }).eq("id", itemId);
    expect(ownerError).toBeNull();
    const { error: price } = await owner.from("treatment_items").update({ price_cents: 1 }).eq("id", itemId);
    expect(price?.code).toBe("OT001");
  });

  it("fechamento: só a gestão fecha; dentista vê só os próprios", async () => {
    const row = (pro: string) => ({ clinic_id: clinicId, professional_id: pro, period_month: "2030-01-01", base: "received" as const, total_gross_cents: 0, total_base_cents: 0, total_commission_cents: 0, lines: [] });
    expect((await dentist.from("commission_closings").insert(row(drAna))).error).not.toBeNull();
    expect((await owner.from("commission_closings").insert(row(drAna))).error).toBeNull();
    expect((await owner.from("commission_closings").insert(row(drBeto))).error).toBeNull();
    expect((await owner.from("commission_closings").insert(row(drAna))).error?.code).toBe("23505");
    const { data } = await dentist.from("commission_closings").select("professional_id");
    expect(data?.map((c) => c.professional_id)).toEqual([drAna]);
    await owner.from("commission_closings").delete().eq("professional_id", drAna);
    const { count } = await admin.from("commission_closings").select("id", { count: "exact", head: true }).eq("professional_id", drAna);
    expect(count).toBe(1); // fechamento é definitivo
  });
});
