/**
 * Fase 3, P6 no banco: sessões por procedimento do plano. Só quem marca
 * realizado registra sessão; no total de sessões o item vira realizado; a
 * consulta com o item reserva a próxima sessão e o "Atendido" conta como feita.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("sessões por procedimento (P6)", () => {
  const env = createTestEnv("sessoes-p6");
  const admin = env.admin;
  const today = todayIso();

  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  let patient = "";
  let itemTwo = "";
  let itemOne = "";
  let pendingItem = "";

  const itemStatus = async (id: string) => (await admin.from("treatment_items").select("status").eq("id", id).single()).data!.status;

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Sessões");
    await env.createUser("outra", "Clínica Outra Sessões");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Sessão" }).select("id").single();
    pro = p!.id;
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Sessões" }).select("id").single();
    patient = pat!.id;
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");

    const { data: plan } = await reception.from("treatment_plans").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patient, professional_id: pro }).select("id").single();
    const { data: items } = await reception
      .from("treatment_items")
      .insert([
        { clinic_id: clinicId, plan_id: plan!.id, description: "Canal", faces: [], price_cents: 90000, position: 0, sessions_planned: 2 },
        { clinic_id: clinicId, plan_id: plan!.id, description: "Clareamento", faces: [], price_cents: 50000, position: 1, sessions_planned: 3 },
        { clinic_id: clinicId, plan_id: plan!.id, description: "Limpeza", faces: [], price_cents: 20000, position: 2, sessions_planned: 1 },
      ])
      .select("id, description");
    itemTwo = items!.find((i) => i.description === "Canal")!.id;
    itemOne = items!.find((i) => i.description === "Clareamento")!.id;
    pendingItem = items!.find((i) => i.description === "Limpeza")!.id;
    await admin.from("treatment_plans").update({ status: "presented" }).eq("id", plan!.id);
    const { error } = await reception.rpc("approve_treatment_plan", {
      _plan_id: plan!.id,
      _item_ids: [itemTwo, itemOne],
      _discount_cents: 0,
      _installments: 1,
      _first_due_date: addDays(today, 10),
      _payment_method_id: null as unknown as string,
    });
    expect(error).toBeNull();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("recepção não registra; dentista registra; no total o item vira realizado; item não aprovado não recebe sessão", async () => {
    const now = new Date().toISOString();
    expect((await reception.from("plan_item_sessions").insert({ clinic_id: clinicId, plan_item_id: itemTwo, done_at: now })).error).not.toBeNull();
    expect((await dentist.from("plan_item_sessions").insert({ clinic_id: clinicId, plan_item_id: itemTwo, done_at: now })).error).toBeNull();
    expect(await itemStatus(itemTwo)).toBe("approved");
    expect((await dentist.from("plan_item_sessions").insert({ clinic_id: clinicId, plan_item_id: itemTwo, done_at: now })).error).toBeNull();
    expect(await itemStatus(itemTwo)).toBe("done");

    const { error } = await dentist.from("plan_item_sessions").insert({ clinic_id: clinicId, plan_item_id: pendingItem, done_at: now });
    expect(error?.code).toBe("OT010");
    expect((await other.from("plan_item_sessions").select("id").eq("plan_item_id", itemTwo)).data).toEqual([]);
    expect((await reception.from("plan_item_sessions").select("id").eq("plan_item_id", itemTwo)).data).toHaveLength(2);
  });

  it("consulta com o item reserva a sessão; Atendido conta como feita; Desmarcado solta", async () => {
    const day = addDays(today, 3);
    const mk = async (hour: string) => {
      const { data: appt } = await reception
        .from("appointments")
        .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patient, professional_id: pro, starts_at: `${day}T${hour}:00:00-03:00`, ends_at: `${day}T${hour}:30:00-03:00` })
        .select("id")
        .single();
      await reception.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: appt!.id, treatment_item_id: itemOne, description: "Clareamento", position: 0 });
      return appt!.id;
    };
    const sessionsOf = async () => (await admin.from("plan_item_sessions").select("appointment_id, done_at").eq("plan_item_id", itemOne)).data!;

    const a1 = await mk("09");
    expect(await sessionsOf()).toEqual([{ appointment_id: a1, done_at: null }]);
    await reception.from("appointments").update({ status: "done" }).eq("id", a1);
    expect((await sessionsOf())[0]!.done_at).not.toBeNull();

    const a2 = await mk("10");
    expect(await sessionsOf()).toHaveLength(2);
    expect((await reception.from("appointments").update({ status: "canceled", cancel_reason: "patient_canceled" }).eq("id", a2)).error).toBeNull();
    expect(await sessionsOf()).toHaveLength(1);
    expect(await itemStatus(itemOne)).toBe("approved");
  });
});
