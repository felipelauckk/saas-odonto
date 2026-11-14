/**
 * Prontuário no banco: dentista escreve, owner/manager só leem (a menos que
 * sejam profissionais), recepção vê apenas os alertas, nada é editado nem
 * apagado, e outra clínica não vê nada.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

const answers = [
  { id: "alergias", label: "Tem alergia?", type: "yes_no", alert: true, details: true, answer: "yes", text: "Penicilina" },
  { id: "diabetes", label: "Tem diabetes?", type: "yes_no", alert: true, details: false, answer: "no", text: null },
  { id: "fumante", label: "Fuma?", type: "yes_no", alert: false, details: false, answer: "yes", text: null },
];

describe.skipIf(!hasSupabase)("prontuário (RLS)", () => {
  const env = createTestEnv("prontuario");
  const admin = env.admin;

  let owner: Client;
  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let patientId = "";
  let drAna = "";
  let ownerPro = "";
  let ownerMemberId = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Prontuário");
    await env.createUser("outra", "Clínica Outra Prontuário");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;

    const dentistMember = await env.addMember(clinicId, dentistUser.userId, "dentist");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");

    const { data: pro } = await admin
      .from("professionals")
      .insert({ clinic_id: clinicId, name: "Dra. Ana", member_id: dentistMember })
      .select("id")
      .single();
    drAna = pro!.id;

    const { data: patient } = await admin
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: "Paciente Prontuário" })
      .select("id")
      .single();
    patientId = patient!.id;

    owner = await env.signIn("owner");
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");

    // O owner ainda não é profissional.
    const { data: ownerMember } = await admin
      .from("clinic_members")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("role", "owner")
      .single();
    const { data: op } = await admin
      .from("professionals")
      .insert({ clinic_id: clinicId, name: "Dono", active: true })
      .select("id")
      .single();
    ownerPro = op!.id;
    ownerMemberId = ownerMember!.id;
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("dentista preenche anamnese, odontograma, evolução e arquivo", async () => {
    const { error: a } = await dentist.from("anamneses").insert({ clinic_id: clinicId, patient_id: patientId, answers });
    expect(a).toBeNull();

    const { error: t } = await dentist
      .from("tooth_records")
      .insert({ clinic_id: clinicId, patient_id: patientId, tooth: 16, faces: ["O", "M"], condition: "caries" });
    expect(t).toBeNull();

    const { error: n } = await dentist
      .from("clinical_notes")
      .insert({ clinic_id: clinicId, patient_id: patientId, professional_id: drAna, body: "Restauração na 16." });
    expect(n).toBeNull();

    const path = `${clinicId}/patients/${patientId}/teste-${Date.now()}.txt`;
    const { error: upload } = await dentist.storage.from("clinic").upload(path, new Blob(["radiografia"]), { contentType: "text/plain" });
    expect(upload).toBeNull();
    const { error: f } = await dentist
      .from("patient_files")
      .insert({ clinic_id: clinicId, patient_id: patientId, storage_path: path, kind: "xray" });
    expect(f).toBeNull();
  });

  it("dente e face inválidos são recusados", async () => {
    const { error: tooth } = await dentist
      .from("tooth_records")
      .insert({ clinic_id: clinicId, patient_id: patientId, tooth: 19, condition: "caries" });
    expect(tooth).not.toBeNull();

    const { error: deciduous } = await dentist
      .from("tooth_records")
      .insert({ clinic_id: clinicId, patient_id: patientId, tooth: 56, condition: "caries" });
    expect(deciduous).not.toBeNull();

    const { error: face } = await dentist
      .from("tooth_records")
      .insert({ clinic_id: clinicId, patient_id: patientId, tooth: 55, faces: ["X"], condition: "caries" });
    expect(face).not.toBeNull();
  });

  it("dentista não assina evolução com outro profissional", async () => {
    const { error } = await dentist
      .from("clinical_notes")
      .insert({ clinic_id: clinicId, patient_id: patientId, professional_id: ownerPro, body: "Falsa" });
    expect(error).not.toBeNull();
  });

  it("nada clínico é editado nem apagado", async () => {
    const { data: note } = await dentist.from("clinical_notes").select("id").limit(1).single();

    const { error: update } = await dentist.from("clinical_notes").update({ body: "Alterada" }).eq("id", note!.id);
    expect(update).not.toBeNull();

    const { error: remove } = await dentist.from("clinical_notes").delete().eq("id", note!.id);
    expect(remove).not.toBeNull();

    const { error: anamnesisUpdate } = await dentist.from("anamneses").update({ answers: [] }).eq("patient_id", patientId);
    expect(anamnesisUpdate).not.toBeNull();

    const { data: file } = await dentist.from("patient_files").select("storage_path").limit(1).single();
    const { data: removed } = await dentist.storage.from("clinic").remove([file!.storage_path]);
    expect(removed ?? []).toEqual([]);
  });

  it("owner lê, mas só escreve se estiver ligado a um profissional", async () => {
    const { data } = await owner.from("clinical_notes").select("id");
    expect(data!.length).toBeGreaterThan(0);

    const { error } = await owner
      .from("tooth_records")
      .insert({ clinic_id: clinicId, patient_id: patientId, tooth: 11, condition: "restored" });
    expect(error).not.toBeNull();

    await admin
      .from("professionals")
      .update({ member_id: ownerMemberId })
      .eq("id", ownerPro);

    const { error: afterLink } = await owner
      .from("clinical_notes")
      .insert({ clinic_id: clinicId, patient_id: patientId, professional_id: ownerPro, body: "Dono que também atende." });
    expect(afterLink).toBeNull();
  });

  it("recepção não lê o prontuário, mas vê os alertas", async () => {
    for (const table of ["anamneses", "tooth_records", "clinical_notes", "patient_files"] as const) {
      const { data } = await reception.from(table).select("id");
      expect(data).toEqual([]);
    }

    const { error } = await reception
      .from("tooth_records")
      .insert({ clinic_id: clinicId, patient_id: patientId, tooth: 11, condition: "caries" });
    expect(error).not.toBeNull();

    const { data: alerts } = await reception.rpc("patient_alerts", { _patient_id: patientId });
    expect(alerts).toEqual([{ label: "Tem alergia?", details: "Penicilina" }]);
  });

  it("os alertas seguem a versão mais recente da anamnese", async () => {
    await dentist.from("anamneses").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      answers: answers.map((a) => (a.id === "alergias" ? { ...a, answer: "no", text: null } : a)),
    });
    const { data: alerts } = await reception.rpc("patient_alerts", { _patient_id: patientId });
    expect(alerts).toEqual([]);

    const { data: versions } = await dentist.from("anamneses").select("id").eq("patient_id", patientId);
    expect(versions).toHaveLength(2);
  });

  it("outra clínica não vê nada nem os alertas", async () => {
    for (const table of ["anamneses", "tooth_records", "clinical_notes", "patient_files"] as const) {
      const { data } = await other.from(table).select("id");
      expect(data).toEqual([]);
    }
    const { data: alerts } = await other.rpc("patient_alerts", { _patient_id: patientId });
    expect(alerts).toEqual([]);

    const { data: file } = await dentist.from("patient_files").select("storage_path").limit(1).single();
    const { data: signed } = await other.storage.from("clinic").createSignedUrl(file!.storage_path, 60);
    expect(signed).toBeNull();
  });
});
