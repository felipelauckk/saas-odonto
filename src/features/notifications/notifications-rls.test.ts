/**
 * Fase 3, P9 no banco: notificações geradas por gatilho, visíveis só para os
 * papéis certos da clínica, com leitura por pessoa.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("notificações (P9)", () => {
  const env = createTestEnv("notificacoes-p9");
  const admin = env.admin;

  let owner: Client;
  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  let patient = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Notificações");
    await env.createUser("outra", "Clínica Outra Notificações");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Aviso" }).select("id").single();
    pro = p!.id;
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Aviso" }).select("id").single();
    patient = pat!.id;
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("agendamento online avisa recepção e gestão; dentista e outra clínica não veem", async () => {
    const day = addDays(todayIso(), 4);
    await admin.from("appointments").insert({
      clinic_id: clinicId,
      unit_id: unitId,
      patient_id: patient,
      professional_id: pro,
      starts_at: `${day}T14:00:00-03:00`,
      ends_at: `${day}T14:30:00-03:00`,
      booked_online: true,
    });
    const { data } = await reception.from("notifications").select("kind, title, link");
    expect(data).toEqual([{ kind: "online_booking", title: "Agendamento online: Paciente Aviso", link: `/agenda?data=${day}` }]);
    expect((await owner.from("notifications").select("id")).data).toHaveLength(1);
    expect((await dentist.from("notifications").select("id")).data).toEqual([]);
    expect((await other.from("notifications").select("id")).data).toEqual([]);
    // Ninguém cria notificação direto.
    expect((await owner.from("notifications").insert({ clinic_id: clinicId, kind: "x", title: "x" })).error).not.toBeNull();
  });

  it("leitura é por pessoa; marcar todas só marca as minhas", async () => {
    const { data: mine } = await reception.from("notifications").select("id").single();
    expect((await reception.from("notification_reads").insert({ notification_id: mine!.id, clinic_id: clinicId })).error).toBeNull();
    expect((await owner.from("notification_reads").select("notification_id")).data).toEqual([]);
    // O dentista não marca o que não é dele.
    expect((await dentist.from("notification_reads").insert({ notification_id: mine!.id, clinic_id: clinicId })).error).not.toBeNull();
    expect((await owner.rpc("mark_all_notifications_read")).data).toBe(1);
    expect((await owner.rpc("mark_all_notifications_read")).data).toBe(0);
  });

  it("lead do formulário e pedido de remarcação também avisam", async () => {
    const { data: stage } = await admin.from("crm_stages").select("id").eq("clinic_id", clinicId).eq("auto_key", "new").single();
    await admin.from("leads").insert({ clinic_id: clinicId, name: "Lead do Site", stage_id: stage!.id, from_public_form: true, interest: "Implante" });
    const { data: appt } = await admin.from("appointments").select("id").eq("patient_id", patient).single();
    await admin.from("appointments").update({ reschedule_requested_at: new Date().toISOString() }).eq("id", appt!.id);
    const kinds = ((await reception.from("notifications").select("kind")).data ?? []).map((n) => n.kind).sort();
    expect(kinds).toEqual(["online_booking", "public_lead", "reschedule_request"]);
  });
});
