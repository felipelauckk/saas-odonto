/**
 * Fichas por especialidade no banco: clínica nova tem os 5 modelos; dentista
 * registra, recepção não lê; versões não se editam; profissional escolhe as
 * próprias fichas; isolamento entre clínicas.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("fichas por especialidade", () => {
  const env = createTestEnv("fichas");
  const admin = env.admin;

  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let patientId = "";
  let dentistUserId = "";
  let drAna = "";
  let drBeto = "";
  let implant: { id: string; name: string; fields: unknown } = { id: "", name: "", fields: [] };

  beforeAll(async () => {
    const owner = await env.createUser("owner", "Clínica Fichas");
    await env.createUser("outra", "Clínica Outra Fichas");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = owner.clinicId!;
    dentistUserId = dentistUser.userId;
    const member = await env.addMember(clinicId, dentistUser.userId, "dentist");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    const { data: pros } = await admin.from("professionals").insert([{ clinic_id: clinicId, name: "Dra. Ana", member_id: member }, { clinic_id: clinicId, name: "Dr. Beto" }]).select("id, name");
    drAna = pros!.find((p) => p.name === "Dra. Ana")!.id;
    drBeto = pros!.find((p) => p.name === "Dr. Beto")!.id;
    const { data: p } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Fichas" }).select("id").single();
    patientId = p!.id;
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("clínica nova tem os cinco modelos prontos", async () => {
    const { data } = await dentist.from("specialty_templates").select("id, name, specialty, fields").order("name");
    expect(data!.map((t) => t.specialty).sort()).toEqual(["endo", "hof", "implant", "ortho", "perio"]);
    implant = data!.find((t) => t.specialty === "implant")!;
    expect((implant.fields as { type: string }[]).some((f) => f.type === "table")).toBe(true);
  });

  it("dentista registra versões; recepção não lê; nada se edita", async () => {
    const row = (filledBy: string, data: Record<string, unknown>) => ({ clinic_id: clinicId, patient_id: patientId, template_id: implant.id, template_name: implant.name, fields: implant.fields as never, data: data as never, professional_id: drAna, filled_by: filledBy });
    const { data: v1, error } = await dentist.from("specialty_records").insert(row(dentistUserId, { planning: "Implante no 36" })).select("id").single();
    expect(error).toBeNull();
    expect((await dentist.from("specialty_records").insert(row(dentistUserId, { planning: "Implante no 36 e 46" }))).error).toBeNull();
    // Não dá para gravar em nome de outra pessoa.
    expect((await dentist.from("specialty_records").insert(row(clinicId, { planning: "x" }))).error).not.toBeNull();
    expect((await dentist.from("specialty_records").select("id").eq("patient_id", patientId)).data).toHaveLength(2);
    expect((await reception.from("specialty_records").select("id")).data).toEqual([]);
    expect((await dentist.from("specialty_records").update({ data: {} } as never).eq("id", v1!.id)).error).not.toBeNull();
    expect((await dentist.from("specialty_records").delete().eq("id", v1!.id).select("id")).data ?? []).toEqual([]);
    expect((await other.from("specialty_records").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
  });

  it("profissional escolhe as próprias fichas, não as dos outros; só a gestão edita modelos", async () => {
    expect((await dentist.from("professional_specialty_forms").insert({ clinic_id: clinicId, professional_id: drAna, template_id: implant.id })).error).toBeNull();
    expect((await dentist.from("professional_specialty_forms").insert({ clinic_id: clinicId, professional_id: drBeto, template_id: implant.id })).error).not.toBeNull();
    expect((await dentist.from("specialty_templates").update({ name: "X" }).eq("id", implant.id).select("id")).data ?? []).toEqual([]);
  });
});
