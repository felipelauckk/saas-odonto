/**
 * Agenda no banco: conflitos de profissional e cadeira, bloqueios, quem vê o
 * quê (dentista só a própria agenda, recepção só unidades permitidas) e
 * isolamento entre clínicas.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

const day = "2030-03-04"; // segunda-feira
const at = (time: string) => `${day}T${time}:00-03:00`;

describe.skipIf(!hasSupabase)("agenda (RLS, conflitos e bloqueios)", () => {
  const env = createTestEnv("agenda");
  const admin = env.admin;

  let owner: Client;
  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let unitA = "";
  let unitB = "";
  let drAna = ""; // ligada ao usuário dentista
  let drBeto = "";
  let chair = "";
  let patient = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Agenda");
    await env.createUser("outra", "Clínica Outra Agenda");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;

    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitA = unit!.id;
    const { data: second } = await admin.from("units").insert({ clinic_id: clinicId, name: "Unidade B" }).select("id").single();
    unitB = second!.id;

    const dentistMember = await env.addMember(clinicId, dentistUser.userId, "dentist");
    const receptionMember = await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await admin.from("clinic_members").update({ unit_ids: [unitA] }).eq("id", receptionMember);

    const { data: pros } = await admin
      .from("professionals")
      .insert([
        { clinic_id: clinicId, name: "Dra. Ana", member_id: dentistMember },
        { clinic_id: clinicId, name: "Dr. Beto" },
      ])
      .select("id, name");
    drAna = pros!.find((p) => p.name === "Dra. Ana")!.id;
    drBeto = pros!.find((p) => p.name === "Dr. Beto")!.id;

    const { data: c } = await admin.from("chairs").insert({ clinic_id: clinicId, unit_id: unitA, name: "Cadeira 1" }).select("id").single();
    chair = c!.id;
    const { data: p } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Agenda" }).select("id").single();
    patient = p!.id;

    owner = await env.signIn("owner");
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const appt = (overrides: Record<string, unknown> = {}) => ({
    clinic_id: clinicId,
    unit_id: unitA,
    patient_id: patient,
    professional_id: drAna,
    starts_at: at("09:00"),
    ends_at: at("10:00"),
    ...overrides,
  });

  it("recepção marca consulta e o profissional não pode ter duas ao mesmo tempo", async () => {
    const { error } = await reception.from("appointments").insert(appt({ chair_id: chair }));
    expect(error).toBeNull();

    const { error: overlap } = await reception
      .from("appointments")
      .insert(appt({ starts_at: at("09:30"), ends_at: at("10:30") }));
    expect(overlap?.code).toBe("23P01");
    expect(overlap?.message).toContain("appointments_professional_no_overlap");

    // Encostado no fim é permitido.
    const { error: adjacent } = await reception
      .from("appointments")
      .insert(appt({ starts_at: at("10:00"), ends_at: at("10:30") }));
    expect(adjacent).toBeNull();
  });

  it("a mesma cadeira não recebe dois pacientes ao mesmo tempo", async () => {
    const { error } = await owner
      .from("appointments")
      .insert(appt({ professional_id: drBeto, chair_id: chair, starts_at: at("09:15"), ends_at: at("09:45") }));
    expect(error?.code).toBe("23P01");
    expect(error?.message).toContain("appointments_chair_no_overlap");
  });

  it("cancelar libera o horário", async () => {
    const { data: first } = await owner
      .from("appointments")
      .insert(appt({ professional_id: drBeto, starts_at: at("14:00"), ends_at: at("15:00") }))
      .select("id")
      .single();
    await owner.from("appointments").update({ status: "canceled" }).eq("id", first!.id);

    const { error } = await owner
      .from("appointments")
      .insert(appt({ professional_id: drBeto, starts_at: at("14:00"), ends_at: at("15:00") }));
    expect(error).toBeNull();
  });

  it("horário bloqueado recusa consulta", async () => {
    const { error: blockError } = await reception.from("schedule_blocks").insert({
      clinic_id: clinicId,
      unit_id: unitA,
      professional_id: drBeto,
      starts_at: at("16:00"),
      ends_at: at("18:00"),
      reason: "Curso",
    });
    expect(blockError).toBeNull();

    const { error } = await reception
      .from("appointments")
      .insert(appt({ professional_id: drBeto, starts_at: at("17:00"), ends_at: at("17:30") }));
    expect(error?.code).toBe("OB001");
    expect(error?.message).toContain("Curso");

    // Outro profissional no mesmo horário pode.
    const { error: otherPro } = await reception
      .from("appointments")
      .insert(appt({ starts_at: at("17:00"), ends_at: at("17:30") }));
    expect(otherPro).toBeNull();
  });

  it("dentista vê e mexe só na própria agenda", async () => {
    const { data } = await dentist.from("appointments").select("professional_id");
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((a) => a.professional_id === drAna)).toBe(true);

    const { error } = await dentist
      .from("appointments")
      .insert(appt({ professional_id: drBeto, starts_at: at("19:00"), ends_at: at("19:30") }));
    expect(error).not.toBeNull();

    const { error: own } = await dentist
      .from("appointments")
      .insert(appt({ starts_at: at("19:00"), ends_at: at("19:30") }));
    expect(own).toBeNull();

    const { error: unitBlock } = await dentist.from("schedule_blocks").insert({
      clinic_id: clinicId,
      unit_id: unitA,
      starts_at: at("12:00"),
      ends_at: at("13:00"),
    });
    expect(unitBlock).not.toBeNull();
  });

  it("recepção só vê e marca nas unidades permitidas", async () => {
    await owner.from("appointments").insert(appt({ unit_id: unitB, professional_id: drBeto, starts_at: at("07:00"), ends_at: at("07:30") }));

    const { data } = await reception.from("appointments").select("unit_id");
    expect(data!.every((a) => a.unit_id === unitA)).toBe(true);

    const { error } = await reception
      .from("appointments")
      .insert(appt({ unit_id: unitB, starts_at: at("20:00"), ends_at: at("20:30") }));
    expect(error).not.toBeNull();
  });

  it("ninguém apaga consulta e outra clínica não vê nada", async () => {
    const { data: rows } = await owner.from("appointments").select("id").limit(1);
    const { error } = await owner.from("appointments").delete().eq("id", rows![0]!.id);
    expect(error).not.toBeNull();

    const { data: foreign } = await other.from("appointments").select("id");
    expect(foreign).toEqual([]);

    const { error: insertError } = await other.from("appointments").insert(appt());
    expect(insertError).not.toBeNull();
  });

  it("confirmar registra a hora da confirmação", async () => {
    const { data } = await owner
      .from("appointments")
      .insert(appt({ professional_id: drBeto, starts_at: at("11:00"), ends_at: at("11:30") }))
      .select("id")
      .single();
    const { data: confirmed } = await owner
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", data!.id)
      .select("confirmed_at")
      .single();
    expect(confirmed?.confirmed_at).not.toBeNull();
  });
});
