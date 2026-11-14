import "server-only";

import { CONFIRM_PREFIX, getMessagingProvider } from "@/lib/messaging";
import { firstName, renderTemplate, toWhatsAppNumber } from "@/lib/messaging/render";
import type { MessageKind, TemplateVariables } from "@/lib/messaging/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, formatLongDate, utcToZoned, zonedToUtc } from "@/lib/timezone";
import { todayIso } from "@/lib/dates";

type Admin = ReturnType<typeof createAdminClient>;

type LogInput = {
  clinicId: string;
  patientId: string | null;
  appointmentId?: string | null;
  kind: MessageKind | null;
  to: string | null;
  body: string | null;
  status: "sent" | "simulated" | "failed" | "received";
  providerId?: string | null;
  error?: string | null;
};

async function log(admin: Admin, input: LogInput) {
  await admin.from("messages_log").insert({
    clinic_id: input.clinicId,
    patient_id: input.patientId,
    appointment_id: input.appointmentId ?? null,
    template_kind: input.kind,
    provider: getMessagingProvider().name,
    to_phone: input.to,
    body: input.body,
    status: input.status,
    provider_id: input.providerId ?? null,
    error: input.error ?? null,
  });
}

async function templateFor(admin: Admin, clinicId: string, kind: MessageKind) {
  const { data } = await admin.from("message_templates").select("body, active").eq("clinic_id", clinicId).eq("kind", kind).maybeSingle();
  return data?.active ? data.body : null;
}

/** Envia (ou simula) uma mensagem e registra no log. Devolve o status final. */
async function deliver(
  admin: Admin,
  params: { clinicId: string; patientId: string; appointmentId?: string; kind: MessageKind; phone: string | null; body: string; variables: TemplateVariables; confirm?: boolean; isReply?: boolean },
) {
  const to = toWhatsAppNumber(params.phone);
  const text = renderTemplate(params.body, params.variables);
  if (!to) {
    await log(admin, { ...params, kind: params.kind, to: null, body: text, status: "failed", error: "Paciente sem WhatsApp válido." });
    return "failed" as const;
  }
  try {
    const result = await getMessagingProvider().send({
      to,
      kind: params.kind,
      text,
      variables: params.variables,
      confirmPayload: params.confirm && params.appointmentId ? `${CONFIRM_PREFIX}${params.appointmentId}` : undefined,
      isReply: params.isReply,
    });
    await log(admin, { ...params, kind: params.kind, to, body: text, status: result.status, providerId: result.providerId });
    return result.status;
  } catch (error) {
    await log(admin, { ...params, kind: params.kind, to, body: text, status: "failed", error: error instanceof Error ? error.message : "Erro no envio." });
    return "failed" as const;
  }
}

async function appointmentContext(admin: Admin, appointmentId: string) {
  const { data } = await admin
    .from("appointments")
    .select("id, clinic_id, patient_id, starts_at, status, patients(full_name, whatsapp, phone), professionals(name), clinics(name)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!data) return null;
  const when = utcToZoned(data.starts_at);
  const variables: TemplateVariables = {
    paciente: firstName(data.patients?.full_name ?? ""),
    clinica: data.clinics?.name ?? "",
    data: formatLongDate(when.date),
    hora: when.time,
    profissional: data.professionals?.name ?? "",
  };
  return { appointment: data, variables, phone: data.patients?.whatsapp ?? data.patients?.phone ?? null };
}

/** Lembrete de uma consulta (cron ou botão na agenda). */
export async function sendAppointmentReminder(appointmentId: string) {
  const admin = createAdminClient();
  const ctx = await appointmentContext(admin, appointmentId);
  if (!ctx) return { status: "failed" as const, error: "Consulta não encontrada." };
  const body = await templateFor(admin, ctx.appointment.clinic_id, "appointment_reminder");
  if (!body) return { status: "failed" as const, error: "O modelo de lembrete está desativado." };

  const status = await deliver(admin, {
    clinicId: ctx.appointment.clinic_id,
    patientId: ctx.appointment.patient_id,
    appointmentId,
    kind: "appointment_reminder",
    phone: ctx.phone,
    body,
    variables: ctx.variables,
    confirm: ctx.appointment.status === "scheduled",
  });
  if (status !== "failed") {
    await admin.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", appointmentId);
  }
  return { status };
}

/** Rotina diária: lembretes das consultas de amanhã e parabéns dos aniversariantes de hoje. */
export async function runDailyMessages({ now = new Date(), clinicId }: { now?: Date; clinicId?: string } = {}) {
  const admin = createAdminClient();
  const today = todayIso(now);
  const tomorrow = addDays(today, 1);
  const summary = { reminders: 0, birthdays: 0, failed: 0 };

  let appointmentsQuery = admin
    .from("appointments")
    .select("id")
    .in("status", ["scheduled", "confirmed"])
    .is("reminder_sent_at", null)
    .gte("starts_at", zonedToUtc(tomorrow, "00:00").toISOString())
    .lt("starts_at", zonedToUtc(addDays(tomorrow, 1), "00:00").toISOString());
  if (clinicId) appointmentsQuery = appointmentsQuery.eq("clinic_id", clinicId);
  const { data: appointments } = await appointmentsQuery;
  for (const a of appointments ?? []) {
    const { status } = await sendAppointmentReminder(a.id);
    if (status === "failed") summary.failed++;
    else summary.reminders++;
  }

  // Aniversariantes: mesmo dia e mês (29/02 comemora em 28/02 nos anos não bissextos).
  const [, month, day] = today.split("-");
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const extra = month === "02" && day === "28" && !isLeap(Number(today.slice(0, 4))) ? ["02-29"] : [];
  let templatesQuery = admin.from("message_templates").select("clinic_id, body").eq("kind", "birthday").eq("active", true);
  if (clinicId) templatesQuery = templatesQuery.eq("clinic_id", clinicId);
  const { data: templates } = await templatesQuery;
  for (const t of templates ?? []) {
    const { data: clinic } = await admin.from("clinics").select("name").eq("id", t.clinic_id).single();
    const { data: patients } = await admin
      .from("patients")
      .select("id, full_name, whatsapp, phone, birth_date")
      .eq("clinic_id", t.clinic_id)
      .is("archived_at", null)
      .not("birth_date", "is", null);
    const birthdays = (patients ?? []).filter((p) => [`${month}-${day}`, ...extra].includes(p.birth_date!.slice(5)));
    for (const p of birthdays) {
      const { count } = await admin
        .from("messages_log")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", p.id)
        .eq("template_kind", "birthday")
        .gte("sent_at", zonedToUtc(today, "00:00").toISOString());
      if (count) continue;
      const status = await deliver(admin, {
        clinicId: t.clinic_id,
        patientId: p.id,
        kind: "birthday",
        phone: p.whatsapp ?? p.phone,
        body: t.body,
        variables: { paciente: firstName(p.full_name), clinica: clinic?.name ?? "" },
      });
      if (status === "failed") summary.failed++;
      else summary.birthdays++;
    }
  }
  return summary;
}

/** Paciente tocou em "Confirmar" no lembrete. */
export async function confirmFromButton(payload: string) {
  if (!payload.startsWith(CONFIRM_PREFIX)) return false;
  const appointmentId = payload.slice(CONFIRM_PREFIX.length);
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return false;

  const admin = createAdminClient();
  const ctx = await appointmentContext(admin, appointmentId);
  if (!ctx) return false;

  await log(admin, {
    clinicId: ctx.appointment.clinic_id,
    patientId: ctx.appointment.patient_id,
    appointmentId,
    kind: null,
    to: null,
    body: "Paciente confirmou pelo WhatsApp.",
    status: "received",
  });

  if (ctx.appointment.status !== "scheduled") return true;
  await admin.from("appointments").update({ status: "confirmed" }).eq("id", appointmentId).eq("status", "scheduled");

  const body = await templateFor(admin, ctx.appointment.clinic_id, "appointment_confirmation");
  if (body) {
    await deliver(admin, {
      clinicId: ctx.appointment.clinic_id,
      patientId: ctx.appointment.patient_id,
      appointmentId,
      kind: "appointment_confirmation",
      phone: ctx.phone,
      body,
      variables: ctx.variables,
      isReply: true,
    });
  }
  return true;
}
