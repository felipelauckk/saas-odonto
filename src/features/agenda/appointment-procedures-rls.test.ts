/**
 * Fase 3, P1 no banco: procedimentos da consulta seguem a permissão da
 * consulta (unidade da recepção, agenda do dentista, clínica) e as colunas de
 * mensagens aceitam só os valores previstos.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

const at = (day: string, time: string) => `${day}T${time}:00-03:00`;

describe.skipIf(!hasSupabase)("procedimentos da consulta (appointment_procedures)", () => {
  const env = createTestEnv("consulta-procedimentos");
  const admin = env.admin;

  let owner: Client;
  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let otherClinicId = "";
  let unitA = "";
  let unitB = "";
  let proAna = "";
  let proBeto = "";
  let patient = "";
  let procedure = "";
  let otherProcedure = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Procedimentos");
    const otherUser = await env.createUser("outra", "Clínica Outra Procedimentos");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    otherClinicId = otherUser.clinicId!;
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitA = unit!.id;
    const { data: second } = await admin.from("units").insert({ clinic_id: clinicId, name: "Unidade B" }).select("id").single();
    unitB = second!.id;
    const receptionMember = await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await admin.from("clinic_members").update({ unit_ids: [unitA] }).eq("id", receptionMember);
    const dentistMember = await env.addMember(clinicId, dentistUser.userId, "dentist");
    const { data: pros } = await admin
      .from("professionals")
      .insert([
        { clinic_id: clinicId, name: "Dra. Ana", member_id: dentistMember },
        { clinic_id: clinicId, name: "Dr. Beto" },
      ])
      .select("id, name");
    proAna = pros!.find((p) => p.name === "Dra. Ana")!.id;
    proBeto = pros!.find((p) => p.name === "Dr. Beto")!.id;
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Procedimentos" }).select("id").single();
    patient = pat!.id;
    const { data: procs } = await admin
      .from("procedures")
      .insert([
        { clinic_id: clinicId, name: "Restauração", duration_min: 40 },
        { clinic_id: otherClinicId, name: "Limpeza da outra", duration_min: 30 },
      ])
      .select("id, clinic_id");
    procedure = procs!.find((p) => p.clinic_id === clinicId)!.id;
    otherProcedure = procs!.find((p) => p.clinic_id === otherClinicId)!.id;
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const book = async (unitId: string, professionalId: string, day: string) => {
    const { data, error } = await admin
      .from("appointments")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patient, professional_id: professionalId, starts_at: at(day, "09:00"), ends_at: at(day, "10:00") })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id;
  };

  it("quem mexe na consulta inclui, lê e tira procedimentos (com dente e faces)", async () => {
    const appointmentId = await book(unitA, proBeto, "2031-02-03");
    const { error } = await reception.from("appointment_procedures").insert([
      { clinic_id: clinicId, appointment_id: appointmentId, procedure_id: procedure, tooth: 36, faces: ["O", "M"], position: 0 },
      { clinic_id: clinicId, appointment_id: appointmentId, procedure_id: procedure, position: 1 },
    ]);
    expect(error).toBeNull();
    const { data } = await reception.from("appointment_procedures").select("tooth, faces, position").eq("appointment_id", appointmentId).order("position");
    expect(data).toEqual([
      { tooth: 36, faces: ["O", "M"], position: 0 },
      { tooth: null, faces: null, position: 1 },
    ]);
    // Não se edita: troca-se a lista.
    expect((await reception.from("appointment_procedures").update({ position: 5 }).eq("appointment_id", appointmentId)).error).not.toBeNull();
    expect((await reception.from("appointment_procedures").delete().eq("appointment_id", appointmentId).select("id")).data).toHaveLength(2);
  });

  it("dente e faces inválidos são recusados", async () => {
    const appointmentId = await book(unitA, proBeto, "2031-02-04");
    expect((await owner.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: appointmentId, procedure_id: procedure, tooth: 19 })).error).not.toBeNull();
    expect((await owner.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: appointmentId, procedure_id: procedure, faces: ["X"] })).error).not.toBeNull();
  });

  it("recepção não mexe em consulta de outra unidade; dentista só na própria agenda", async () => {
    const inB = await book(unitB, proBeto, "2031-02-05");
    await admin.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: inB, procedure_id: procedure });
    expect((await reception.from("appointment_procedures").select("id").eq("appointment_id", inB)).data).toEqual([]);
    expect((await reception.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: inB, procedure_id: procedure })).error).not.toBeNull();

    const ana = await book(unitA, proAna, "2031-02-06");
    expect((await dentist.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: ana, procedure_id: procedure })).error).toBeNull();
    expect((await dentist.from("appointment_procedures").select("id").eq("appointment_id", inB)).data).toEqual([]);
    expect((await dentist.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: inB, procedure_id: procedure })).error).not.toBeNull();
  });

  it("outra clínica não lê nem grava; procedimento de outra clínica não entra", async () => {
    const appointmentId = await book(unitA, proBeto, "2031-02-07");
    await admin.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: appointmentId, procedure_id: procedure });
    expect((await other.from("appointment_procedures").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
    expect((await other.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: appointmentId, procedure_id: procedure })).error).not.toBeNull();
    expect((await other.from("appointment_procedures").insert({ clinic_id: otherClinicId, appointment_id: appointmentId, procedure_id: otherProcedure })).error).not.toBeNull();
    expect((await owner.from("appointment_procedures").insert({ clinic_id: clinicId, appointment_id: appointmentId, procedure_id: otherProcedure })).error).not.toBeNull();
    expect((await other.from("appointment_procedures").delete().eq("appointment_id", appointmentId).select("id")).data ?? []).toEqual([]);
  });

  it("mensagens por consulta: recepção grava os modos; valor fora da lista é recusado", async () => {
    const appointmentId = await book(unitA, proBeto, "2031-02-10");
    const { data, error } = await reception
      .from("appointments")
      .update({ confirmation_mode: "none", reminder_mode: "none" })
      .eq("id", appointmentId)
      .select("confirmation_mode, reminder_mode")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ confirmation_mode: "none", reminder_mode: "none" });
    expect((await reception.from("appointments").update({ reminder_mode: "now" }).eq("id", appointmentId)).error).not.toBeNull();
  });
});
