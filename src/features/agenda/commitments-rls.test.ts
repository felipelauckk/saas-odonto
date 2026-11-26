/**
 * Fase 3, P2 no banco: compromisso que bloqueia impede consulta e evento não;
 * editar segue a regra de criar (unidade da recepção, agenda do dentista, nunca
 * a clínica toda para o dentista); clínicas isoladas.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

const at = (day: string, time: string) => `${day}T${time}:00-03:00`;

describe.skipIf(!hasSupabase)("compromissos (schedule_blocks)", () => {
  const env = createTestEnv("compromissos");
  const admin = env.admin;

  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let unitA = "";
  let unitB = "";
  let proAna = "";
  let proBeto = "";
  let patient = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Compromissos");
    await env.createUser("outra", "Clínica Outra Compromissos");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
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
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Compromissos" }).select("id").single();
    patient = pat!.id;
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const block = async (fields: { professional_id: string | null; day: string; kind?: "block" | "event"; title?: string; unit?: string }) => {
    const { data, error } = await admin
      .from("schedule_blocks")
      .insert({
        clinic_id: clinicId,
        unit_id: fields.unit ?? unitA,
        professional_id: fields.professional_id,
        title: fields.title ?? "Almoço",
        kind: fields.kind ?? "block",
        starts_at: at(fields.day, "12:00"),
        ends_at: at(fields.day, "13:00"),
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id;
  };

  const book = (client: Client, day: string, professionalId: string) =>
    client.from("appointments").insert({ clinic_id: clinicId, unit_id: unitA, patient_id: patient, professional_id: professionalId, starts_at: at(day, "12:15"), ends_at: at(day, "12:45") });

  it("bloqueio impede consulta com o nome na mensagem; evento não impede", async () => {
    await block({ professional_id: proBeto, day: "2031-03-03", title: "Curso" });
    const { error } = await book(reception, "2031-03-03", proBeto);
    expect(error?.code).toBe("OB001");
    expect(error?.message).toContain("Curso");

    await block({ professional_id: proBeto, day: "2031-03-04", kind: "event", title: "Reunião" });
    expect((await book(reception, "2031-03-04", proBeto)).error).toBeNull();
  });

  it("valores inválidos de tipo e nome são recusados", async () => {
    const base = { clinic_id: clinicId, unit_id: unitA, professional_id: proBeto, starts_at: at("2031-03-05", "12:00"), ends_at: at("2031-03-05", "13:00") };
    expect((await reception.from("schedule_blocks").insert({ ...base, kind: "lembrete" })).error).not.toBeNull();
    expect((await reception.from("schedule_blocks").insert({ ...base, title: "  " })).error).not.toBeNull();
    expect((await reception.from("schedule_blocks").insert({ ...base, title: "Reunião", kind: "event", notes: "Sala 2" })).error).toBeNull();
  });

  it("recepção edita compromisso da sua unidade, não o de outra", async () => {
    const mine = await block({ professional_id: proBeto, day: "2031-03-10" });
    const { data, error } = await reception.from("schedule_blocks").update({ title: "Almoço longo", kind: "event" }).eq("id", mine).select("title, kind").single();
    expect(error).toBeNull();
    expect(data).toEqual({ title: "Almoço longo", kind: "event" });

    const elsewhere = await block({ professional_id: proBeto, day: "2031-03-10", unit: unitB });
    expect((await reception.from("schedule_blocks").update({ title: "X" }).eq("id", elsewhere).select("id")).data).toEqual([]);
  });

  it("dentista edita a própria agenda, mas não a clínica toda nem passa o dele para a clínica toda", async () => {
    const own = await block({ professional_id: proAna, day: "2031-03-11" });
    expect((await dentist.from("schedule_blocks").update({ title: "Curso" }).eq("id", own).select("id")).data).toHaveLength(1);
    expect((await dentist.from("schedule_blocks").update({ professional_id: null }).eq("id", own)).error).not.toBeNull();

    const clinicWide = await block({ professional_id: null, day: "2031-03-11", title: "Feriado" });
    expect((await dentist.from("schedule_blocks").update({ title: "X" }).eq("id", clinicWide).select("id")).data).toEqual([]);
    expect((await dentist.from("schedule_blocks").delete().eq("id", clinicWide).select("id")).data).toEqual([]);
    const beto = await block({ professional_id: proBeto, day: "2031-03-11" });
    expect((await dentist.from("schedule_blocks").update({ title: "X" }).eq("id", beto).select("id")).data).toEqual([]);
  });

  it("série: as ocorrências compartilham series_id; outra clínica não vê nem mexe", async () => {
    const seriesId = crypto.randomUUID();
    await admin.from("schedule_blocks").insert(
      ["2031-04-07", "2031-04-14", "2031-04-21"].map((day) => ({
        clinic_id: clinicId,
        unit_id: unitA,
        professional_id: proBeto,
        title: "Almoço",
        kind: "block",
        notes: null,
        all_day: false,
        series_id: seriesId,
        starts_at: at(day, "12:00"),
        ends_at: at(day, "13:00"),
      })),
    );
    const { data: seen } = await reception.from("schedule_blocks").select("id").eq("series_id", seriesId);
    expect(seen).toHaveLength(3);
    expect((await other.from("schedule_blocks").select("id").eq("series_id", seriesId)).data).toEqual([]);
    expect((await other.from("schedule_blocks").update({ title: "X" }).eq("series_id", seriesId).select("id")).data).toEqual([]);
  });
});
