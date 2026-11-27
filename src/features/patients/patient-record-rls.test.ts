/**
 * Fase 3, P5 no banco: notas gerais do paciente (todo membro escreve; só o
 * autor ou a gestão apaga) e pastas de arquivos (prontuário: quem lê/escreve
 * o prontuário), com exame (tipo e data) no arquivo.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("ficha do paciente (P5)", () => {
  const env = createTestEnv("ficha-p5");
  const admin = env.admin;

  let owner: Client;
  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let patient = "";
  let patient2 = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Ficha");
    await env.createUser("outra", "Clínica Outra Ficha");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
    const { data } = await admin
      .from("patients")
      .insert([
        { clinic_id: clinicId, full_name: "Paciente Ficha" },
        { clinic_id: clinicId, full_name: "Outro Paciente Ficha" },
      ])
      .select("id, full_name");
    patient = data!.find((p) => p.full_name === "Paciente Ficha")!.id;
    patient2 = data!.find((p) => p.full_name !== "Paciente Ficha")!.id;
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("notas: todo membro escreve e lê; não edita o texto; autor ou gestão apaga; outra clínica não vê", async () => {
    const { data: note, error } = await reception
      .from("patient_notes")
      .insert({ clinic_id: clinicId, patient_id: patient, body: "Prefere horários à tarde" })
      .select("id, author_name, created_by")
      .single();
    expect(error).toBeNull();
    expect(note!.author_name).toBeTruthy();
    expect((await dentist.from("patient_notes").select("body").eq("id", note!.id).single()).data).toEqual({ body: "Prefere horários à tarde" });
    expect((await other.from("patient_notes").select("id").eq("patient_id", patient)).data).toEqual([]);

    // Texto não se edita (sem permissão na coluna).
    expect((await reception.from("patient_notes").update({ body: "X" }).eq("id", note!.id)).error).not.toBeNull();
    // Dentista não fixa nem apaga a nota da recepção.
    expect((await dentist.from("patient_notes").update({ pinned: true }).eq("id", note!.id).select("id")).data).toEqual([]);
    expect((await dentist.from("patient_notes").delete().eq("id", note!.id).select("id")).data).toEqual([]);
    // O autor fixa; a gestão apaga.
    expect((await reception.from("patient_notes").update({ pinned: true }).eq("id", note!.id).select("pinned").single()).data).toEqual({ pinned: true });
    expect((await owner.from("patient_notes").delete().eq("id", note!.id).select("id")).data).toHaveLength(1);

    // Não dá para gravar nota em nome de outra pessoa nem em outra clínica.
    expect((await other.from("patient_notes").insert({ clinic_id: clinicId, patient_id: patient, body: "Intrusa" })).error).not.toBeNull();
  });

  it("pastas: quem escreve no prontuário cria e move; recepção não vê; apagar a pasta devolve os arquivos para 'sem pasta'", async () => {
    const { data: folder, error } = await dentist.from("patient_file_folders").insert({ clinic_id: clinicId, patient_id: patient, name: "Inicial" }).select("id").single();
    expect(error).toBeNull();
    expect((await reception.from("patient_file_folders").select("id").eq("patient_id", patient)).data).toEqual([]);
    expect((await reception.from("patient_file_folders").insert({ clinic_id: clinicId, patient_id: patient, name: "Recepção" })).error).not.toBeNull();
    expect((await other.from("patient_file_folders").select("id").eq("patient_id", patient)).data).toEqual([]);

    const path = `${clinicId}/patients/${patient}/p5-teste.png`;
    const { data: file, error: fileError } = await dentist
      .from("patient_files")
      .insert({ clinic_id: clinicId, patient_id: patient, storage_path: path, kind: "photo", mime_type: "image/png", size_bytes: 10, folder_id: folder!.id })
      .select("id, folder_id")
      .single();
    expect(fileError).toBeNull();
    expect(file!.folder_id).toBe(folder!.id);

    // Pasta de outro paciente não serve.
    const { data: folder2 } = await dentist.from("patient_file_folders").insert({ clinic_id: clinicId, patient_id: patient2, name: "Inicial" }).select("id").single();
    expect((await dentist.from("patient_files").update({ folder_id: folder2!.id }).eq("id", file!.id)).error?.code).toBe("OC020");
    // Recepção não reorganiza o prontuário.
    expect((await reception.from("patient_files").update({ folder_id: null }).eq("id", file!.id).select("id")).data ?? []).toEqual([]);

    // Exame: tipo e data; categoria fica no kind.
    const { error: examError } = await dentist
      .from("patient_files")
      .insert({ clinic_id: clinicId, patient_id: patient, storage_path: `${clinicId}/patients/${patient}/p5-exame.png`, kind: "xray", exam_type: "panoramica", taken_on: "2026-11-01" });
    expect(examError).toBeNull();
    expect((await dentist.from("patient_files").update({ exam_type: "invalido" }).eq("storage_path", `${clinicId}/patients/${patient}/p5-exame.png`)).error).not.toBeNull();

    expect((await dentist.from("patient_file_folders").delete().eq("id", folder!.id).select("id")).data).toHaveLength(1);
    expect((await admin.from("patient_files").select("folder_id").eq("id", file!.id).single()).data).toEqual({ folder_id: null });
  });
});
