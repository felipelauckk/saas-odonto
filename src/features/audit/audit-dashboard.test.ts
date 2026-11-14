/**
 * Auditoria (alterações por gatilho, aberturas por log_access, só a gestão lê,
 * ninguém apaga) e indicadores do painel (respeitam a RLS de quem pede).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("auditoria e painel", () => {
  const env = createTestEnv("auditoria");
  const admin = env.admin;
  const today = todayIso();

  let owner: Client;
  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let patientId = "";
  let drAna = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Auditoria");
    await env.createUser("outra", "Clínica Outra Auditoria");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    const dentistMember = await env.addMember(clinicId, dentistUser.userId, "dentist");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");

    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    const { data: pros } = await admin
      .from("professionals")
      .insert([
        { clinic_id: clinicId, name: "Dra. Ana", member_id: dentistMember },
        { clinic_id: clinicId, name: "Dr. Beto" },
      ])
      .select("id, name");
    drAna = pros!.find((p) => p.name === "Dra. Ana")!.id;
    const drBeto = pros!.find((p) => p.name === "Dr. Beto")!.id;
    const { data: patient } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Auditoria" }).select("id").single();
    patientId = patient!.id;

    // Consultas de hoje (uma de cada profissional) e recebíveis.
    await admin.from("appointments").insert([
      { clinic_id: clinicId, unit_id: unit!.id, patient_id: patientId, professional_id: drAna, starts_at: `${today}T23:00:00-03:00`, ends_at: `${today}T23:30:00-03:00` },
      { clinic_id: clinicId, unit_id: unit!.id, patient_id: patientId, professional_id: drBeto, starts_at: `${today}T23:00:00-03:00`, ends_at: `${today}T23:30:00-03:00` },
    ]);
    await admin.from("receivables").insert([
      { clinic_id: clinicId, unit_id: unit!.id, patient_id: patientId, professional_id: drAna, description: "Da Ana", amount_cents: 10000, due_date: "2099-01-01" },
      { clinic_id: clinicId, unit_id: unit!.id, patient_id: patientId, professional_id: drBeto, description: "Do Beto", amount_cents: 30000, due_date: "2099-01-01" },
    ]);

    owner = await env.signIn("owner");
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("alteração clínica e abertura ficam registradas com o autor", async () => {
    await dentist.from("clinical_notes").insert({ clinic_id: clinicId, patient_id: patientId, professional_id: drAna, body: "Evolução auditada." });
    await dentist.rpc("log_access", { _action: "view", _table_name: "clinical_notes", _record_id: null as unknown as string, _patient_id: patientId });

    const { data } = await owner.from("audit_log").select("action, table_name, patient_id").order("at");
    expect(data).toEqual(
      expect.arrayContaining([
        { action: "insert", table_name: "clinical_notes", patient_id: patientId },
        { action: "view", table_name: "clinical_notes", patient_id: patientId },
      ]),
    );
  });

  it("só a gestão lê; ninguém altera nem apaga; outra clínica não registra aqui", async () => {
    expect((await dentist.from("audit_log").select("id")).data).toEqual([]);
    expect((await reception.from("audit_log").select("id")).data).toEqual([]);

    const { error } = await owner.from("audit_log").delete().eq("clinic_id", clinicId);
    expect(error).not.toBeNull();

    await other.rpc("log_access", { _action: "view", _table_name: "patients", _record_id: null as unknown as string, _patient_id: patientId });
    const { count } = await admin.from("audit_log").select("id", { count: "exact", head: true }).neq("clinic_id", clinicId).eq("patient_id", patientId);
    expect(count).toBe(0);
  });

  it("indicadores: gestão vê tudo, dentista só o próprio", async () => {
    const { data: all } = await owner.rpc("dashboard_metrics", {});
    expect(all).toMatchObject({ appointments_today: 2, receivable_open_cents: 40000 });

    const { data: mine } = await dentist.rpc("dashboard_metrics", {});
    expect(mine).toMatchObject({ appointments_today: 1, receivable_open_cents: 10000 });
  });
});
