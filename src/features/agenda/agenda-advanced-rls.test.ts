/**
 * Agenda avançada no banco: marcadores (gestão cadastra, quem vê a consulta
 * marca), primeira consulta automática, motivo obrigatório ao desmarcar, hora
 * de chegada, lista de espera por unidade e retorno que sai da lista ao marcar.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

const at = (day: string, time: string) => `${day}T${time}:00-03:00`;

describe.skipIf(!hasSupabase)("agenda avançada (marcadores, espera, retornos)", () => {
  const env = createTestEnv("agenda-avancada");
  const admin = env.admin;

  let owner: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let unitA = "";
  let unitB = "";
  let pro = "";
  let patient = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Agenda Avançada");
    await env.createUser("outra", "Clínica Outra Avançada");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitA = unit!.id;
    const { data: second } = await admin.from("units").insert({ clinic_id: clinicId, name: "Unidade B" }).select("id").single();
    unitB = second!.id;
    const receptionMember = await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await admin.from("clinic_members").update({ unit_ids: [unitA] }).eq("id", receptionMember);
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana" }).select("id").single();
    pro = p!.id;
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Avançada" }).select("id").single();
    patient = pat!.id;
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const book = (client: Client, day: string, time = "09:00", end = "10:00") =>
    client
      .from("appointments")
      .insert({ clinic_id: clinicId, unit_id: unitA, patient_id: patient, professional_id: pro, starts_at: at(day, time), ends_at: at(day, end) })
      .select("id, is_first_visit")
      .single();

  it("clínica nova tem marcadores padrão; só a gestão cadastra; quem vê a consulta marca", async () => {
    const { data: tags } = await reception.from("appointment_tags").select("id, name");
    expect(tags!.map((t) => t.name)).toContain("Urgência");
    expect((await reception.from("appointment_tags").insert({ clinic_id: clinicId, name: "VIP" })).error).not.toBeNull();
    expect((await owner.from("appointment_tags").insert({ clinic_id: clinicId, name: "VIP", color: "#000000" })).error).toBeNull();

    const { data: a } = await book(reception, "2030-05-06");
    const tag = tags!.find((t) => t.name === "Urgência")!.id;
    expect((await reception.from("appointment_tag_links").insert({ clinic_id: clinicId, appointment_id: a!.id, tag_id: tag })).error).toBeNull();
    expect((await other.from("appointment_tags").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
    expect((await other.from("appointment_tag_links").select("tag_id").eq("clinic_id", clinicId)).data).toEqual([]);
  });

  it("primeira consulta é marcada até o paciente ser atendido", async () => {
    const { data: first } = await book(reception, "2030-06-03");
    expect(first!.is_first_visit).toBe(true);
    await admin.from("appointments").update({ status: "done" }).eq("id", first!.id);
    const { data: later } = await book(reception, "2030-07-01");
    expect(later!.is_first_visit).toBe(false);
  });

  it("chegada registra a hora; desmarcar exige motivo", async () => {
    const { data: a } = await book(reception, "2030-08-05");
    const { data: arrived } = await reception.from("appointments").update({ status: "arrived" }).eq("id", a!.id).select("arrived_at").single();
    expect(arrived!.arrived_at).not.toBeNull();

    const { data: b } = await book(reception, "2030-08-06");
    const { error } = await reception.from("appointments").update({ status: "canceled" }).eq("id", b!.id);
    expect(error?.code).toBe("OA001");
    const { data: ok, error: okErr } = await reception
      .from("appointments")
      .update({ status: "canceled", cancel_reason: "clinic_canceled", cancel_note: "Dentista doente" })
      .eq("id", b!.id)
      .select("cancel_reason")
      .single();
    expect(okErr).toBeNull();
    expect(ok!.cancel_reason).toBe("clinic_canceled");
  });

  it("lista de espera respeita as unidades do usuário", async () => {
    expect((await reception.from("waitlist").insert({ clinic_id: clinicId, unit_id: unitA, patient_id: patient, period: "morning" })).error).toBeNull();
    expect((await reception.from("waitlist").insert({ clinic_id: clinicId, unit_id: unitB, patient_id: patient })).error).not.toBeNull();
    await owner.from("waitlist").insert({ clinic_id: clinicId, unit_id: unitB, patient_id: patient });
    const { data: seen } = await reception.from("waitlist").select("unit_id");
    expect(seen!.every((w) => w.unit_id === unitA)).toBe(true);
    expect((await other.from("waitlist").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
  });

  it("retorno pendente sai da lista quando o paciente marca nova consulta", async () => {
    const { data: r } = await reception
      .from("patient_returns")
      .insert({ clinic_id: clinicId, patient_id: patient, reason: "Limpeza", due_date: "2030-10-01" })
      .select("id")
      .single();
    const { data: a } = await book(reception, "2030-10-07");
    const { data: after } = await reception.from("patient_returns").select("status, scheduled_appointment_id").eq("id", r!.id).single();
    expect(after).toEqual({ status: "scheduled", scheduled_appointment_id: a!.id });
    expect((await other.from("patient_returns").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
  });
});
