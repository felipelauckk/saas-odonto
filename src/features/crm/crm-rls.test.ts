/**
 * CRM no banco: quem usa, motivo obrigatório ao perder, funil que anda sozinho
 * (nunca para trás) com consulta e orçamento, etapas padrão protegidas e
 * formulário público.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

import { submitPublicLeadCore } from "./public-form";

describe.skipIf(!hasSupabase)("CRM (funil e captação)", () => {
  const env = createTestEnv("crm");
  const admin = env.admin;
  const today = todayIso();

  let owner: Client;
  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  const stage: Record<string, string> = {};

  const stageOf = async (leadId: string) => (await admin.from("leads").select("stage_id").eq("id", leadId).single()).data!.stage_id;

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica CRM");
    await env.createUser("outra", "Clínica Outra CRM");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana" }).select("id").single();
    pro = p!.id;
    const { data: stages } = await admin.from("crm_stages").select("id, auto_key").eq("clinic_id", clinicId);
    for (const s of stages!) stage[s.auto_key!] = s.id;
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("clínica nova tem o funil padrão; recepção cria lead; dentista e outra clínica não veem", async () => {
    expect(Object.keys(stage).sort()).toEqual(["attended", "evaluation_scheduled", "lost", "new", "quote_presented", "talking", "won"]);
    const { data: instagram } = await reception.from("patient_sources").select("id").eq("key", "instagram").single();
    const { error } = await reception.from("leads").insert({ clinic_id: clinicId, name: "Lead Teste", phone: "11977776666", source_id: instagram!.id, stage_id: stage.new! });
    expect(error).toBeNull();
    expect((await dentist.from("leads").select("id")).data).toEqual([]);
    expect((await dentist.from("leads").insert({ clinic_id: clinicId, name: "X", stage_id: stage.new! })).error).not.toBeNull();
    expect((await other.from("leads").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
  });

  it("perder exige motivo; voltar ao funil limpa o motivo", async () => {
    const { data: lead } = await reception.from("leads").insert({ clinic_id: clinicId, name: "Lead Perdido", stage_id: stage.new! }).select("id").single();
    const { error } = await reception.from("leads").update({ stage_id: stage.lost! }).eq("id", lead!.id);
    expect(error?.code).toBe("OC001");
    expect((await reception.from("leads").update({ stage_id: stage.lost!, lost_reason: "Achou caro" }).eq("id", lead!.id)).error).toBeNull();
    const { data } = await reception.from("leads").update({ stage_id: stage.talking! }).eq("id", lead!.id).select("lost_reason").single();
    expect(data!.lost_reason).toBeNull();
  });

  it("depois de virar paciente, consulta e orçamento movem o lead para a frente (nunca para trás)", async () => {
    const { data: patient } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Lead Convertido" }).select("id").single();
    const { data: lead } = await reception.from("leads").insert({ clinic_id: clinicId, name: "Lead Convertido", stage_id: stage.new! }).select("id").single();
    await reception.from("leads").update({ patient_id: patient!.id }).eq("id", lead!.id);
    expect(await stageOf(lead!.id)).toBe(stage.new);

    const day = addDays(today, 2);
    const { data: appt } = await reception
      .from("appointments")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patient!.id, professional_id: pro, starts_at: `${day}T10:00:00-03:00`, ends_at: `${day}T10:30:00-03:00` })
      .select("id")
      .single();
    expect(await stageOf(lead!.id)).toBe(stage.evaluation_scheduled);
    await reception.from("appointments").update({ status: "arrived" }).eq("id", appt!.id);
    expect(await stageOf(lead!.id)).toBe(stage.attended);

    const { data: plan } = await reception.from("treatment_plans").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patient!.id, professional_id: pro }).select("id").single();
    const { data: item } = await reception.from("treatment_items").insert({ clinic_id: clinicId, plan_id: plan!.id, description: "Limpeza", faces: [], price_cents: 20000, position: 0 }).select("id").single();
    await admin.from("treatment_plans").update({ status: "presented" }).eq("id", plan!.id);
    expect(await stageOf(lead!.id)).toBe(stage.quote_presented);
    const { error } = await reception.rpc("approve_treatment_plan", {
      _plan_id: plan!.id, _item_ids: [item!.id], _discount_cents: 0, _installments: 1, _first_due_date: addDays(today, 10), _payment_method_id: null as unknown as string,
    });
    expect(error).toBeNull();
    expect(await stageOf(lead!.id)).toBe(stage.won);

    // Nova consulta não volta o lead para "Avaliação agendada".
    await reception.from("appointments").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patient!.id, professional_id: pro, starts_at: `${addDays(today, 9)}T10:00:00-03:00`, ends_at: `${addDays(today, 9)}T10:30:00-03:00` });
    expect(await stageOf(lead!.id)).toBe(stage.won);
  });

  it("etapa padrão não sai; etapa criada sai; só a gestão configura", async () => {
    expect((await owner.from("crm_stages").delete().eq("id", stage.talking!)).error?.code).toBe("OC002");
    expect((await reception.from("crm_stages").insert({ clinic_id: clinicId, name: "Recepção cria", position: 45 })).error).not.toBeNull();
    const { data: custom } = await owner.from("crm_stages").insert({ clinic_id: clinicId, name: "Retornar em 30 dias", position: 45 }).select("id").single();
    expect((await owner.from("crm_stages").delete().eq("id", custom!.id).select("id")).data).toHaveLength(1);
  });

  it("formulário público cria lead; robô e token errado não", async () => {
    const { data: clinic } = await admin.from("clinics").select("lead_form_token").eq("id", clinicId).single();
    const token = clinic!.lead_form_token;
    const base = { token, name: "Maria do Site", phone: "(11) 95555-4444", interest: "Clareamento", source: "google", startedAt: String(Date.now() - 10_000) };

    expect(await submitPublicLeadCore(base)).toEqual({});
    expect(await submitPublicLeadCore({ ...base, name: "Robô", phone: "11911112222", website: "spam" })).toEqual({});
    expect(await submitPublicLeadCore({ ...base, name: "Rápido", phone: "11933334444", startedAt: String(Date.now()) })).toEqual({});
    expect((await submitPublicLeadCore({ ...base, token: "0".repeat(32) })).error).toBe("Formulário indisponível.");

    const { data: leads } = await admin.from("leads").select("name, patient_sources(key), stage_id, from_public_form, interest, phone").eq("clinic_id", clinicId).eq("from_public_form", true);
    expect(leads).toEqual([{ name: "Maria do Site", patient_sources: { key: "google" }, stage_id: stage.new, from_public_form: true, interest: "Clareamento", phone: "11955554444" }]);
    // Reenvio do mesmo telefone em seguida não duplica.
    await submitPublicLeadCore(base);
    expect((await admin.from("leads").select("id").eq("clinic_id", clinicId).eq("from_public_form", true)).data).toHaveLength(1);
  });

  it("link de indicação: lead entra com quem indicou e origem Indicação; paciente de outra clínica é ignorado", async () => {
    const { data: clinic } = await admin.from("clinics").select("lead_form_token").eq("id", clinicId).single();
    const { data: referrer } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Quem Indica" }).select("id").single();
    const base = { token: clinic!.lead_form_token, name: "Amiga Indicada", phone: "(11) 94444-3333", source: "site", startedAt: String(Date.now() - 10_000) };
    expect(await submitPublicLeadCore({ ...base, referredBy: referrer!.id })).toEqual({});
    const { data: lead } = await admin.from("leads").select("referred_by_patient_id, patient_sources(key)").eq("clinic_id", clinicId).eq("name", "Amiga Indicada").single();
    expect(lead).toEqual({ referred_by_patient_id: referrer!.id, patient_sources: { key: "indicacao" } });

    const { data: foreign } = await admin.from("patients").select("id").neq("clinic_id", clinicId).limit(1).maybeSingle();
    if (foreign) {
      expect(await submitPublicLeadCore({ ...base, name: "Outra Indicada", phone: "11922223333", referredBy: foreign.id })).toEqual({});
      const { data: lead2 } = await admin.from("leads").select("referred_by_patient_id").eq("clinic_id", clinicId).eq("name", "Outra Indicada").single();
      expect(lead2!.referred_by_patient_id).toBeNull();
    }
  });
});
