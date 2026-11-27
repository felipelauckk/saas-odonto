/**
 * Fase 3, P4 no banco: origens por clínica (padrões, só a gestão edita),
 * outros telefones, numeração automática do prontuário, histórico de edição
 * do cadastro e foto do paciente no bucket privado.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("cadastro completo do paciente (P4)", () => {
  const env = createTestEnv("cadastro-p4");
  const admin = env.admin;

  let owner: Client;
  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let otherClinicId = "";
  let patient = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Cadastro");
    const otherUser = await env.createUser("outra", "Clínica Outra Cadastro");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    otherClinicId = otherUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
    const { data } = await reception.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Cadastro" }).select("id").single();
    patient = data!.id;
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("clínica nova tem as 13 origens padrão, sem convênio, na ordem", async () => {
    const { data } = await reception.from("patient_sources").select("name, key, active").order("position");
    expect(data!.map((s) => s.name)).toEqual(["Indicação", "Instagram", "Google", "Facebook", "Site", "Escola", "Outdoor", "Panfleto", "Placa/fachada", "Rádio", "TV", "Revista", "Outros"]);
    expect(data!.every((s) => s.active)).toBe(true);
    expect(data!.some((s) => /conv[eê]nio/i.test(s.name))).toBe(false);
  });

  it("só a gestão inclui e edita origens; ninguém apaga; outra clínica não vê", async () => {
    expect((await reception.from("patient_sources").insert({ clinic_id: clinicId, name: "Feira" })).error).not.toBeNull();
    const { data: created, error } = await owner.from("patient_sources").insert({ clinic_id: clinicId, name: "Feira de saúde", position: 20 }).select("id").single();
    expect(error).toBeNull();
    expect((await reception.from("patient_sources").update({ name: "X" }).eq("id", created!.id).select("id")).data).toEqual([]);
    expect((await owner.from("patient_sources").update({ active: false }).eq("id", created!.id).select("active").single()).data).toEqual({ active: false });
    expect((await owner.from("patient_sources").delete().eq("id", created!.id)).error).not.toBeNull();
    expect((await other.from("patient_sources").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
    // Origem de outra clínica não entra no paciente desta.
    const { data: foreign } = await admin.from("patient_sources").select("id").eq("clinic_id", otherClinicId).limit(1).single();
    expect((await reception.from("patients").update({ source_id: foreign!.id }).eq("id", patient)).error).not.toBeNull();
  });

  it("outros telefones: membros da clínica mexem; outra clínica não", async () => {
    expect((await reception.from("patient_phones").insert({ clinic_id: clinicId, patient_id: patient, label: "Trabalho", number: "1133334444" })).error).toBeNull();
    expect((await dentist.from("patient_phones").select("number").eq("patient_id", patient)).data).toEqual([{ number: "1133334444" }]);
    expect((await reception.from("patient_phones").insert({ clinic_id: clinicId, patient_id: patient, number: "12" })).error).not.toBeNull();
    expect((await other.from("patient_phones").select("id").eq("patient_id", patient)).data).toEqual([]);
    expect((await other.from("patient_phones").insert({ clinic_id: otherClinicId, patient_id: patient, number: "1133334444" })).error).not.toBeNull();
  });

  it("numeração automática: próximo número, pula o que foi usado à mão, e não repete", async () => {
    await admin.from("clinics").update({ patient_record_auto: true, patient_record_next: 100 }).eq("id", clinicId);
    await reception.from("patients").insert({ clinic_id: clinicId, full_name: "Manual 101", record_number: "101" });
    const { data: a } = await reception.from("patients").insert({ clinic_id: clinicId, full_name: "Auto A" }).select("record_number").single();
    const { data: b } = await reception.from("patients").insert({ clinic_id: clinicId, full_name: "Auto B" }).select("record_number").single();
    expect([a!.record_number, b!.record_number]).toEqual(["100", "102"]);
    const { error } = await reception.from("patients").insert({ clinic_id: clinicId, full_name: "Repetido", record_number: "100" });
    expect(error?.code).toBe("23505");
    await admin.from("clinics").update({ patient_record_auto: false }).eq("id", clinicId);
    const { data: c } = await reception.from("patients").insert({ clinic_id: clinicId, full_name: "Sem número" }).select("record_number").single();
    expect(c!.record_number).toBeNull();
  });

  it("histórico: quem mudou, de → para, visível a qualquer membro; outra clínica não vê", async () => {
    await reception.from("patients").update({ nickname: "Paci", occupation: "Professora" }).eq("id", patient);
    const { data } = await dentist.rpc("patient_history", { _patient_id: patient });
    const update = data!.find((h) => h.action === "update");
    expect(update?.changes).toMatchObject({ nickname: { from: null, to: "Paci" }, occupation: { from: null, to: "Professora" } });
    expect(Object.keys(update!.changes as object)).not.toContain("updated_at");
    expect(data!.some((h) => h.action === "insert")).toBe(true);
    expect((await other.rpc("patient_history", { _patient_id: patient })).data).toEqual([]);
  });

  it("foto: membro envia na pasta da clínica; não na de outra clínica", async () => {
    const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
    const mine = `${clinicId}/patient-photos/${patient}/foto.png`;
    expect((await reception.storage.from("clinic").upload(mine, png, { contentType: "image/png" })).error).toBeNull();
    expect((await reception.from("patients").update({ photo_path: mine }).eq("id", patient)).error).toBeNull();
    expect((await dentist.storage.from("clinic").createSignedUrl(mine, 60)).data?.signedUrl).toBeTruthy();
    expect((await other.storage.from("clinic").createSignedUrl(mine, 60)).data?.signedUrl ?? null).toBeNull();
    const foreign = `${otherClinicId}/patient-photos/${patient}/foto.png`;
    expect((await reception.storage.from("clinic").upload(foreign, png, { contentType: "image/png" })).error).not.toBeNull();
    await admin.storage.from("clinic").remove([mine]);
  });

  it("migração: as origens antigas saíram e toda clínica tem a lista nova", async () => {
    // A cópia das origens antigas foi conferida no banco antes da limpeza (0 sem origem nova).
    expect((await admin.from("patients").select("source").limit(1)).error).not.toBeNull();
    expect((await admin.from("leads").select("source").limit(1)).error).not.toBeNull();
    const { data: clinics } = await admin.from("clinics").select("id").in("id", [clinicId, otherClinicId]);
    for (const c of clinics ?? []) {
      const { count } = await admin.from("patient_sources").select("id", { count: "exact", head: true }).eq("clinic_id", c.id).not("key", "is", null);
      expect(count).toBeGreaterThanOrEqual(13);
    }
  });
});
