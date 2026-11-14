/**
 * Pacientes no banco: isolamento entre clínicas, sem exclusão, CPF único por
 * clínica e a busca por nome (sem acento), CPF e telefone.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("pacientes (RLS e busca)", () => {
  const env = createTestEnv("pacientes");

  let owner: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let otherClinicId = "";
  let joaoId = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Pacientes");
    const otherUser = await env.createUser("outra", "Clínica Vizinha");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    otherClinicId = otherUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");

    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");

    const { data, error } = await owner
      .from("patients")
      .insert([
        { clinic_id: clinicId, full_name: "João Conceição", cpf: "52998224725", phone: "11988887777" },
        { clinic_id: clinicId, full_name: "Maria Silva", whatsapp: "21977776666" },
        { clinic_id: clinicId, full_name: "Ana Paula Souza" },
      ])
      .select("id, full_name");
    if (error) throw error;
    joaoId = data.find((p) => p.full_name.startsWith("João"))!.id;

    await other.from("patients").insert({ clinic_id: otherClinicId, full_name: "João de Outra Clínica" });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("recepção cadastra, edita e arquiva", async () => {
    const { data: created, error } = await reception
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: "Paciente da Recepção" })
      .select("id")
      .single();
    expect(error).toBeNull();

    const { data: archived } = await reception
      .from("patients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", created!.id)
      .select("archived_at")
      .single();
    expect(archived?.archived_at).not.toBeNull();
  });

  it("ninguém apaga paciente", async () => {
    const { error } = await owner.from("patients").delete().eq("id", joaoId);
    expect(error).not.toBeNull();

    const { data } = await owner.from("patients").select("id").eq("id", joaoId);
    expect(data).toHaveLength(1);
  });

  it("CPF é único dentro da clínica", async () => {
    const { error } = await owner
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: "Duplicado", cpf: "52998224725" });
    expect(error?.code).toBe("23505");
  });

  it("o mesmo CPF pode existir em outra clínica", async () => {
    const { error } = await other
      .from("patients")
      .insert({ clinic_id: otherClinicId, full_name: "Mesmo CPF", cpf: "52998224725" });
    expect(error).toBeNull();
  });

  it("outra clínica não vê, não acha na busca e não edita", async () => {
    const { data: direct } = await other.from("patients").select("id").eq("id", joaoId);
    expect(direct).toEqual([]);

    const { data: found } = await other.rpc("search_patients", { _query: "conceicao" });
    expect(found).toEqual([]);

    const { data: updated } = await other
      .from("patients")
      .update({ full_name: "Invadido" })
      .eq("id", joaoId)
      .select("id");
    expect(updated).toEqual([]);

    const { error } = await other.from("patients").insert({ clinic_id: clinicId, full_name: "Intruso" });
    expect(error).not.toBeNull();
  });

  it("busca por nome sem acento, parte do nome, CPF e telefone", async () => {
    const names = async (query: string) => {
      const { data, error } = await owner.rpc("search_patients", { _query: query });
      if (error) throw error;
      return data.map((p) => p.full_name);
    };

    expect(await names("joao conceicao")).toEqual(["João Conceição"]);
    expect(await names("PAULA")).toEqual(["Ana Paula Souza"]);
    expect(await names("529.982")).toEqual(["João Conceição"]);
    expect(await names("98888-7777")).toEqual(["João Conceição"]);
    expect(await names("97777")).toEqual(["Maria Silva"]);
    expect(await names("")).toEqual(["Ana Paula Souza", "João Conceição", "Maria Silva"]);
  });

  it("separa ativos e arquivados e informa o total", async () => {
    const { data: active } = await owner.rpc("search_patients", { _status: "active", _limit: 2 });
    expect(active).toHaveLength(2);
    expect(Number(active?.[0]?.total_count)).toBe(3);

    const { data: archived } = await owner.rpc("search_patients", { _status: "archived" });
    expect(archived?.map((p) => p.full_name)).toEqual(["Paciente da Recepção"]);
  });
});
