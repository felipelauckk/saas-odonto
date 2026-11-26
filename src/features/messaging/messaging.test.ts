/**
 * Mensagens com o provedor simulado: rotina diária (lembrete de amanhã e
 * aniversário), confirmação pelo botão via webhook assinado e permissões do log.
 */
import { createHmac } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("mensagens (WhatsApp simulado)", () => {
  const env = createTestEnv("mensagens");
  const admin = env.admin;
  const today = todayIso();
  const tomorrow = addDays(today, 1);

  let reception: Client;
  let dentist: Client;
  let clinicId = "";
  let appointmentId = "";
  let noReminderId = "";
  let confirmNowId = "";
  let birthdayPatient = "";

  beforeAll(async () => {
    vi.stubEnv("WHATSAPP_PROVIDER", "");
    vi.stubEnv("WHATSAPP_APP_SECRET", "segredo-teste");
    const owner = await env.createUser("owner", "Clínica Mensagens");
    clinicId = owner.clinicId!;
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await env.addMember(clinicId, dentistUser.userId, "dentist");

    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    const { data: pro } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Bia" }).select("id").single();
    const { data: patient } = await admin
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: "Ana Lembrete", whatsapp: "11988887777" })
      .select("id")
      .single();
    const { data: appt } = await admin
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        unit_id: unit!.id,
        patient_id: patient!.id,
        professional_id: pro!.id,
        starts_at: `${tomorrow}T09:30:00-03:00`,
        ends_at: `${tomorrow}T10:00:00-03:00`,
      })
      .select("id")
      .single();
    appointmentId = appt!.id;
    // Fase 3 P1: consulta marcada "lembrete na véspera: não enviar" e outra que pede confirmação na hora.
    const { data: quiet } = await admin
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: "Carla Sem Lembrete", whatsapp: "11977770000" })
      .select("id")
      .single();
    const { data: extra, error: extraError } = await admin
      .from("appointments")
      .insert([
        { clinic_id: clinicId, unit_id: unit!.id, patient_id: quiet!.id, professional_id: pro!.id, starts_at: `${tomorrow}T11:00:00-03:00`, ends_at: `${tomorrow}T11:30:00-03:00`, confirmation_mode: "auto", reminder_mode: "none" },
        { clinic_id: clinicId, unit_id: unit!.id, patient_id: quiet!.id, professional_id: pro!.id, starts_at: `${addDays(today, 3)}T11:00:00-03:00`, ends_at: `${addDays(today, 3)}T11:30:00-03:00`, confirmation_mode: "now", reminder_mode: "auto" },
      ])
      .select("id, reminder_mode");
    expect(extraError).toBeNull();
    noReminderId = extra!.find((a) => a.reminder_mode === "none")!.id;
    confirmNowId = extra!.find((a) => a.reminder_mode === "auto")!.id;

    const [, m, d] = today.split("-");
    const { data: bday } = await admin
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: "Bruno Aniversário", whatsapp: "21977776666", birth_date: `1990-${m}-${d}` })
      .select("id")
      .single();
    birthdayPatient = bday!.id;
    await admin.from("patient_returns").insert({ clinic_id: clinicId, patient_id: patient!.id, reason: "Limpeza", due_date: today });

    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await env.cleanup();
  });

  it("clínica nova tem os quatro modelos", async () => {
    const { data } = await admin.from("message_templates").select("kind").eq("clinic_id", clinicId);
    expect(data?.map((t) => t.kind).sort()).toEqual(["appointment_confirmation", "appointment_reminder", "birthday", "return_reminder"]);
  });

  it("rotina diária manda o lembrete de amanhã, o parabéns e o retorno vencido (uma vez só)", async () => {
    const { runDailyMessages } = await import("./service");
    await runDailyMessages({ clinicId });

    const { data: logs } = await admin.from("messages_log").select("template_kind, status, to_phone, body, patient_id").eq("clinic_id", clinicId);
    const reminder = logs!.find((l) => l.template_kind === "appointment_reminder");
    expect(reminder?.status).toBe("simulated");
    expect(reminder?.to_phone).toBe("5511988887777");
    expect(reminder?.body).toContain("Olá, Ana!");
    expect(reminder?.body).toContain("09:30");
    expect(logs!.some((l) => l.template_kind === "birthday" && l.patient_id === birthdayPatient)).toBe(true);
    expect(logs!.find((l) => l.template_kind === "return_reminder")?.body).toContain("hora do seu retorno");
    const { data: ret } = await admin.from("patient_returns").select("notified_at").eq("clinic_id", clinicId).single();
    expect(ret?.notified_at).not.toBeNull();

    const { data: appt } = await admin.from("appointments").select("reminder_sent_at").eq("id", appointmentId).single();
    expect(appt?.reminder_sent_at).not.toBeNull();

    // "Lembrete na véspera: não enviar" fica de fora da rotina.
    expect(logs!.some((l) => l.template_kind === "appointment_reminder" && l.body?.includes("Carla"))).toBe(false);
    const { data: quiet } = await admin.from("appointments").select("reminder_sent_at").eq("id", noReminderId).single();
    expect(quiet?.reminder_sent_at).toBeNull();

    // Rodar de novo não duplica.
    await runDailyMessages({ clinicId });
    const { count } = await admin.from("messages_log").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId);
    expect(count).toBe(logs!.length);
  });

  it("pedido de confirmação na hora não conta como o lembrete da véspera", async () => {
    const { sendAppointmentReminder } = await import("./service");
    const result = await sendAppointmentReminder(confirmNowId, { markSent: false });
    expect(result.status).toBe("simulated");
    const { data } = await admin.from("appointments").select("reminder_sent_at").eq("id", confirmNowId).single();
    expect(data?.reminder_sent_at).toBeNull();
  });

  it("webhook: assinatura errada é recusada; botão Confirmar confirma a consulta", async () => {
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const body = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ type: "button", button: { payload: `CONFIRMAR:${appointmentId}` } }] } }] }],
    });

    const forged = await POST(new Request("http://x/api/whatsapp/webhook", { method: "POST", body, headers: { "x-hub-signature-256": "sha256=errada" } }));
    expect(forged.status).toBe(401);

    const signature = `sha256=${createHmac("sha256", "segredo-teste").update(body).digest("hex")}`;
    const ok = await POST(new Request("http://x/api/whatsapp/webhook", { method: "POST", body, headers: { "x-hub-signature-256": signature } }));
    expect(ok.status).toBe(200);

    const { data: appt } = await admin.from("appointments").select("status, confirmed_at").eq("id", appointmentId).single();
    expect(appt?.status).toBe("confirmed");
    expect(appt?.confirmed_at).not.toBeNull();
  });

  it("recepção lê o log; dentista não; ninguém grava pelo app", async () => {
    const { data: receptionLogs } = await reception.from("messages_log").select("id");
    expect(receptionLogs!.length).toBeGreaterThan(0);
    const { data: dentistLogs } = await dentist.from("messages_log").select("id");
    expect(dentistLogs).toEqual([]);
    const { error } = await reception
      .from("messages_log")
      .insert({ clinic_id: clinicId, provider: "x", status: "sent" } as never);
    expect(error).not.toBeNull();
  });
});
