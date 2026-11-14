/**
 * Teste de isolamento entre clínicas, contra o projeto Supabase real.
 * Cria duas clínicas (A e B) e prova, chamando a API direto, que um usuário
 * nunca lê nem altera dados de outra clínica. Apaga tudo no final.
 *
 * Só roda com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
 * SUPABASE_SERVICE_ROLE_KEY no .env.local.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient, createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("isolamento entre clínicas (RLS)", () => {
  const env = createTestEnv("isolamento");
  const admin = env.admin;
  const anon = anonClient();

  let a: Client;
  let b: Client;
  let reception: Client;
  let clinicA = "";
  let clinicB = "";
  let unitB = "";
  let userB = "";
  let userReception = "";
  let clinicBName = "";

  beforeAll(async () => {
    const a0 = await env.createUser("a", "Clínica A");
    const b0 = await env.createUser("b", "Clínica B");
    userB = b0.userId;
    userReception = (await env.createUser("recepcao")).userId;

    clinicA = a0.clinicId!;
    clinicB = b0.clinicId!;
    clinicBName = b0.clinicName!;

    const { data: unit, error } = await admin
      .from("units")
      .select("id")
      .eq("clinic_id", clinicB)
      .single();
    if (error) throw error;
    unitB = unit.id;

    a = await env.signIn("a");
    b = await env.signIn("b");
    reception = await env.signIn("recepcao");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("o cadastro cria clínica em teste, unidade principal e owner", async () => {
    const { data: clinic } = await admin.from("clinics").select("*").eq("id", clinicA).single();
    expect(clinic?.subscription_status).toBe("trialing");
    expect(clinic?.trial_ends_at).not.toBeNull();

    const { data: units } = await admin.from("units").select("name").eq("clinic_id", clinicA);
    expect(units).toEqual([{ name: "Unidade principal" }]);

    const { data: role } = await a.rpc("has_role", { _roles: ["owner"] });
    expect(role).toBe(true);
  });

  it("cada usuário só lê a própria clínica", async () => {
    const { data: clinics } = await a.from("clinics").select("id");
    expect(clinics?.map((c) => c.id)).toEqual([clinicA]);

    const { data: units } = await a.from("units").select("clinic_id");
    expect(units?.every((u) => u.clinic_id === clinicA)).toBe(true);
    expect(units?.length).toBe(1);

    const { data: members } = await a.from("clinic_members").select("clinic_id");
    expect(members?.every((m) => m.clinic_id === clinicA)).toBe(true);

    const { data: profiles } = await a.from("profiles").select("id");
    expect(profiles?.map((p) => p.id)).not.toContain(userB);
  });

  it("buscar a clínica B pelo id não devolve nada", async () => {
    const { data: clinic } = await a.from("clinics").select("id").eq("id", clinicB);
    expect(clinic).toEqual([]);

    const { data: unit } = await a.from("units").select("id").eq("id", unitB);
    expect(unit).toEqual([]);
  });

  it("não altera a clínica nem a unidade de outra clínica", async () => {
    const { data: clinic } = await a
      .from("clinics")
      .update({ name: "Invadida" })
      .eq("id", clinicB)
      .select("id");
    expect(clinic).toEqual([]);

    const { data: unit } = await a
      .from("units")
      .update({ name: "Invadida" })
      .eq("id", unitB)
      .select("id");
    expect(unit).toEqual([]);

    const { data: check } = await admin.from("clinics").select("name").eq("id", clinicB).single();
    expect(check?.name).toBe(clinicBName);
  });

  it("não cria unidade nem membro em outra clínica", async () => {
    const { error: unitError } = await a.from("units").insert({ clinic_id: clinicB, name: "Intrusa" });
    expect(unitError).not.toBeNull();

    const { error: memberError } = await a
      .from("clinic_members")
      .insert({ clinic_id: clinicB, user_id: userReception, role: "receptionist" });
    expect(memberError).not.toBeNull();
  });

  it("não troca para uma clínica da qual não é membro", async () => {
    const { error } = await a.rpc("set_active_clinic", { _clinic_id: clinicB });
    expect(error).not.toBeNull();

    // Gravar a clínica ativa direto no perfil é proibido (privilégio por coluna).
    const { error: directError } = await a
      .from("profiles")
      .update({ active_clinic_id: clinicB } as never)
      .eq("id", (await a.auth.getUser()).data.user!.id);
    expect(directError).not.toBeNull();

    const { data: current } = await a.rpc("current_clinic_id");
    expect(current).toBe(clinicA);
  });

  it("owner não altera dados de assinatura", async () => {
    const { error } = await a
      .from("clinics")
      .update({ subscription_status: "active" } as never)
      .eq("id", clinicA);
    expect(error).not.toBeNull();
  });

  it("sem login não se lê nada", async () => {
    const { data: clinics } = await anon.from("clinics").select("id");
    expect(clinics ?? []).toEqual([]);

    const { data: members } = await anon.from("clinic_members").select("id");
    expect(members ?? []).toEqual([]);
  });

  it("recepção convidada só vê a clínica que a convidou e não administra", async () => {
    const { error: inviteError } = await b
      .from("clinic_members")
      .insert({ clinic_id: clinicB, user_id: userReception, role: "receptionist" });
    expect(inviteError).toBeNull();

    const { data: current } = await reception.rpc("current_clinic_id");
    expect(current).toBe(clinicB);

    const { data: clinics } = await reception.from("clinics").select("id");
    expect(clinics?.map((c) => c.id)).toEqual([clinicB]);

    const { data: renamed } = await reception
      .from("clinics")
      .update({ name: "Mudada pela recepção" })
      .eq("id", clinicB)
      .select("id");
    expect(renamed).toEqual([]);

    const { error: unitError } = await reception.from("units").insert({ clinic_id: clinicB, name: "Nova" });
    expect(unitError).not.toBeNull();

    const { error: promoteError } = await reception
      .from("clinic_members")
      .update({ role: "owner" })
      .eq("user_id", userReception)
      .select("id")
      .single();
    expect(promoteError).not.toBeNull();
  });

  it("a clínica não fica sem owner ativo", async () => {
    const { error } = await b
      .from("clinic_members")
      .update({ active: false })
      .eq("user_id", userB)
      .eq("clinic_id", clinicB);
    expect(error).not.toBeNull();
  });
});
