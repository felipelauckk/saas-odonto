/**
 * Configurações da clínica no banco: dados iniciais, permissões por papel,
 * isolamento entre clínicas e a trava de horários sobrepostos.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("configurações (RLS e dados iniciais)", () => {
  const env = createTestEnv("config");
  const admin = env.admin;

  let owner: Client;
  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let otherClinicId = "";
  let unitId = "";
  let professionalId = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Config");
    const otherUser = await env.createUser("outra", "Clínica Outra");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    otherClinicId = otherUser.clinicId!;

    await env.addMember(clinicId, dentistUser.userId, "dentist");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");

    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;

    owner = await env.signIn("owner");
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");

    const { data: professional, error } = await owner
      .from("professionals")
      .insert({ clinic_id: clinicId, name: "Dra. Ana", cro: "SP-12345", color: "#2563eb" })
      .select("id")
      .single();
    if (error) throw error;
    professionalId = professional.id;
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("clínica nova nasce com procedimentos sem preço, formas de pagamento e anamnese padrão", async () => {
    const { data: procedures } = await owner.from("procedures").select("price_cents");
    expect(procedures?.length).toBeGreaterThanOrEqual(30);
    expect(procedures?.every((p) => p.price_cents === 0)).toBe(true);

    const { data: methods } = await owner.from("payment_methods").select("name");
    expect(methods?.map((m) => m.name)).toContain("Pix");

    const { data: templates } = await owner.from("anamnesis_templates").select("is_default, questions");
    expect(templates).toHaveLength(1);
    expect(templates?.[0]?.is_default).toBe(true);
    expect(Array.isArray(templates?.[0]?.questions)).toBe(true);
  });

  it("dentista e recepção leem, mas não alteram", async () => {
    for (const client of [dentist, reception]) {
      const { data: procedures } = await client.from("procedures").select("id").limit(1);
      expect(procedures?.length).toBe(1);

      const { error: insertError } = await client
        .from("procedures")
        .insert({ clinic_id: clinicId, name: "Não pode" });
      expect(insertError).not.toBeNull();

      const { data: updated } = await client
        .from("procedures")
        .update({ price_cents: 999 })
        .eq("clinic_id", clinicId)
        .select("id");
      expect(updated).toEqual([]);

      const { error: chairError } = await client
        .from("chairs")
        .insert({ clinic_id: clinicId, unit_id: unitId, name: "Não pode" });
      expect(chairError).not.toBeNull();
    }
  });

  it("owner cria cadeira e edita preço", async () => {
    const { error: chairError } = await owner
      .from("chairs")
      .insert({ clinic_id: clinicId, unit_id: unitId, name: "Cadeira 1" });
    expect(chairError).toBeNull();

    const { data: procedure } = await owner.from("procedures").select("id").limit(1).single();
    const { data: updated } = await owner
      .from("procedures")
      .update({ price_cents: 15000 })
      .eq("id", procedure!.id)
      .select("price_cents")
      .single();
    expect(updated?.price_cents).toBe(15000);
  });

  it("outra clínica não vê nem usa nada desta", async () => {
    const { data: procedures } = await other.from("procedures").select("clinic_id");
    expect(procedures?.every((p) => p.clinic_id === otherClinicId)).toBe(true);

    const { data: professionals } = await other.from("professionals").select("id").eq("id", professionalId);
    expect(professionals).toEqual([]);

    // Nem gravando com o clinic_id da outra clínica.
    const { error } = await other
      .from("procedures")
      .insert({ clinic_id: clinicId, name: "Intruso" });
    expect(error).not.toBeNull();

    // Nem apontando a cadeira da própria clínica para a unidade da outra.
    const { error: chairError } = await other
      .from("chairs")
      .insert({ clinic_id: otherClinicId, unit_id: unitId, name: "Cruzada" });
    expect(chairError).not.toBeNull();
  });

  it("recusa horários sobrepostos do mesmo profissional", async () => {
    const base = { clinic_id: clinicId, unit_id: unitId, professional_id: professionalId, weekday: 1 };

    const { error: first } = await owner
      .from("professional_schedules")
      .insert({ ...base, start_time: "08:00", end_time: "12:00" });
    expect(first).toBeNull();

    const { error: afternoon } = await owner
      .from("professional_schedules")
      .insert({ ...base, start_time: "13:00", end_time: "18:00" });
    expect(afternoon).toBeNull();

    const { error: overlap } = await owner
      .from("professional_schedules")
      .insert({ ...base, start_time: "11:00", end_time: "14:00" });
    expect(overlap?.code).toBe("23P01");
  });
});
