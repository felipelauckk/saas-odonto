/**
 * Fase 3, P3 no banco: só a gestão exclui consulta, e só se não houver
 * evolução clínica ligada. Recepção, dentista e outra clínica não excluem.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

const at = (day: string, time: string) => `${day}T${time}:00-03:00`;

describe.skipIf(!hasSupabase)("excluir consulta", () => {
  const env = createTestEnv("excluir-consulta");
  const admin = env.admin;

  let owner: Client;
  let manager: Client;
  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  let patient = "";
  let day = 1;

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Excluir");
    await env.createUser("outra", "Clínica Outra Excluir");
    const managerUser = await env.createUser("gestor");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    await env.addMember(clinicId, managerUser.userId, "manager");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    const dentistMember = await env.addMember(clinicId, dentistUser.userId, "dentist");
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana", member_id: dentistMember }).select("id").single();
    pro = p!.id;
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Excluir" }).select("id").single();
    patient = pat!.id;
    owner = await env.signIn("owner");
    manager = await env.signIn("gestor");
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const book = async () => {
    const d = `2031-05-${String(day++).padStart(2, "0")}`;
    const { data, error } = await admin
      .from("appointments")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patient, professional_id: pro, starts_at: at(d, "09:00"), ends_at: at(d, "09:30") })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id;
  };
  const del = (client: Client, id: string) => client.from("appointments").delete().eq("id", id).select("id");

  it("owner e manager excluem consulta sem evolução; os procedimentos vão junto", async () => {
    const a = await book();
    const { data: proc } = await admin.from("procedures").insert({ clinic_id: clinicId, name: "Limpeza" }).select("id").single();
    await admin.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: a, procedure_id: proc!.id });
    expect((await del(owner, a)).data).toHaveLength(1);
    expect((await admin.from("appointment_procedures").select("id").eq("appointment_id", a)).data).toEqual([]);
    expect((await del(manager, await book())).data).toHaveLength(1);
  });

  it("com evolução ligada, ninguém exclui (nem a gestão)", async () => {
    const a = await book();
    await admin.from("clinical_notes").insert({ clinic_id: clinicId, patient_id: patient, professional_id: pro, appointment_id: a, body: "Restauração feita." });
    expect((await owner.rpc("appointment_has_clinical_record", { _appointment_id: a })).data).toBe(true);
    expect((await del(owner, a)).data).toEqual([]);
    expect((await admin.from("appointments").select("id").eq("id", a)).data).toHaveLength(1);
  });

  it("recepção, dentista e outra clínica não excluem", async () => {
    const a = await book();
    expect((await del(reception, a)).data ?? []).toEqual([]);
    expect((await del(dentist, a)).data ?? []).toEqual([]);
    expect((await del(other, a)).data ?? []).toEqual([]);
    expect((await admin.from("appointments").select("id").eq("id", a)).data).toHaveLength(1);
  });
});
