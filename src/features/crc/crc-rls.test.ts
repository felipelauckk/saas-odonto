/**
 * CRC no banco: filas calculadas com a permissão de quem consulta, item que sai
 * sozinho quando o motivo se resolve, registro de contatos só pela recepção e
 * gestão, e indicador de recuperação.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("CRC (filas e contatos)", () => {
  const env = createTestEnv("crc");
  const admin = env.admin;
  const today = todayIso();

  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  let quotePatient = "";
  let missPatient = "";
  let planId = "";
  let itemId = "";
  let receptionUserId = "";

  const queue = async (client: Client, name: string) => ((await client.rpc("crc_items")).data ?? []).filter((i) => i.queue === name);

  beforeAll(async () => {
    const owner = await env.createUser("owner", "Clínica CRC");
    await env.createUser("outra", "Clínica Outra CRC");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = owner.clinicId!;
    receptionUserId = receptionUser.userId;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana" }).select("id").single();
    pro = p!.id;
    const [, m, d] = addDays(today, 3).split("-");
    const { data: pats } = await admin
      .from("patients")
      .insert([
        { clinic_id: clinicId, full_name: "Paciente Orçamento CRC", whatsapp: "11988887777" },
        { clinic_id: clinicId, full_name: "Paciente Falta CRC", birth_date: `1985-${m}-${d}` },
      ])
      .select("id, full_name");
    quotePatient = pats!.find((x) => x.full_name.startsWith("Paciente Orçamento"))!.id;
    missPatient = pats!.find((x) => x.full_name.startsWith("Paciente Falta"))!.id;
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("orçamento apresentado entra na fila com o valor; dentista não vê a CRC", async () => {
    const { data: plan } = await reception
      .from("treatment_plans")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: quotePatient, professional_id: pro })
      .select("id")
      .single();
    planId = plan!.id;
    const { data: item } = await reception
      .from("treatment_items")
      .insert({ clinic_id: clinicId, plan_id: planId, description: "Coroa", faces: [], price_cents: 50000, position: 0 })
      .select("id")
      .single();
    itemId = item!.id;
    await admin.from("treatment_plans").update({ status: "presented", presented_at: new Date().toISOString() }).eq("id", planId);

    const quotes = await queue(reception, "open_quotes");
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ patient_id: quotePatient, amount_cents: 50000, phone: "11988887777", item_key: `plan:${planId}` });

    expect((await dentist.rpc("crc_items")).data).toEqual([]);
    const { error } = await dentist.from("crc_contacts").insert({
      clinic_id: clinicId, patient_id: quotePatient, queue: "open_quotes", item_key: `plan:${planId}`, channel: "call", created_by: receptionUserId,
    });
    expect(error).not.toBeNull();
  });

  it("contato registrado; aprovação tira da fila e conta como recuperado", async () => {
    const { error } = await reception.from("crc_contacts").insert({
      clinic_id: clinicId, patient_id: quotePatient, queue: "open_quotes", item_key: `plan:${planId}`, ref_id: planId,
      channel: "whatsapp", outcome: "thinking", amount_cents: 50000, created_by: receptionUserId,
    });
    expect(error).toBeNull();
    expect((await other.from("crc_contacts").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
    expect((await reception.from("crc_contacts").update({ notes: "x" } as never).eq("clinic_id", clinicId).select("id")).data ?? []).toEqual([]);

    const { error: approveError } = await reception.rpc("approve_treatment_plan", {
      _plan_id: planId,
      _item_ids: [itemId],
      _discount_cents: 0,
      _installments: 1,
      _first_due_date: addDays(today, -1),
      _payment_method_id: null as unknown as string,
    });
    expect(approveError).toBeNull();

    expect(await queue(reception, "open_quotes")).toHaveLength(0);
    // Aprovado, sem consulta marcada e com parcela vencida: aparece nas outras filas.
    expect((await queue(reception, "untreated"))[0]?.amount_cents).toBe(50000);
    expect((await queue(reception, "overdue_payments"))[0]?.amount_cents).toBe(50000);

    const { data: stats } = await reception.rpc("crc_stats", { _from: addDays(today, -1), _to: today });
    expect(stats?.find((s) => s.queue === "open_quotes")).toMatchObject({ contacted: 1, recovered: 1, recovered_cents: 50000 });
  });

  it("marcar consulta tira o tratamento da fila", async () => {
    await admin.from("appointments").insert({
      clinic_id: clinicId, unit_id: unitId, patient_id: quotePatient, professional_id: pro,
      starts_at: `${addDays(today, 5)}T10:00:00-03:00`, ends_at: `${addDays(today, 5)}T10:30:00-03:00`,
    });
    expect(await queue(reception, "untreated")).toHaveLength(0);
  });

  it("falta na primeira consulta e aniversariante; remarcar tira da fila de faltas", async () => {
    const day = addDays(today, -3);
    const { data: appt } = await admin
      .from("appointments")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: missPatient, professional_id: pro, starts_at: `${day}T09:00:00-03:00`, ends_at: `${day}T09:30:00-03:00` })
      .select("id")
      .single();
    await admin.from("appointments").update({ status: "no_show" }).eq("id", appt!.id);

    expect((await queue(reception, "first_visit_no_shows")).map((i) => i.patient_id)).toEqual([missPatient]);
    expect(await queue(reception, "no_shows")).toHaveLength(0);
    expect((await queue(reception, "birthdays")).find((i) => i.patient_id === missPatient)?.ref_date).toBe(addDays(today, 3));

    await admin.from("appointments").insert({
      clinic_id: clinicId, unit_id: unitId, patient_id: missPatient, professional_id: pro,
      starts_at: `${addDays(today, 6)}T11:00:00-03:00`, ends_at: `${addDays(today, 6)}T11:30:00-03:00`,
    });
    expect(await queue(reception, "first_visit_no_shows")).toHaveLength(0);
  });

  it("outra clínica não vê nenhum item", async () => {
    expect(((await other.rpc("crc_items")).data ?? []).filter((i) => [quotePatient, missPatient].includes(i.patient_id))).toEqual([]);
  });
});
