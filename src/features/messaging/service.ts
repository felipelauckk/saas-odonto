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
export async function deliver(
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
    .select("id, clinic_id, patient_id, starts_at, status, confirmation_mode, patients(full_name, whatsapp, phone), professionals(name), clinics(name)")
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

/**
 * Lembrete de uma consulta (cron ou botão na agenda). Leva o botão "Confirmar"
 * se a consulta ainda não foi confirmada e não está marcada "não pedir confirmação".
 * `markSent: false` (pedido de confirmação ao marcar) não conta como o lembrete
 * da véspera, que continua saindo.
 */
export async function sendAppointmentReminder(appointmentId: string, { markSent = true }: { markSent?: boolean } = {}) {
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
    confirm: ctx.appointment.status === "scheduled" && ctx.appointment.confirmation_mode !== "none",
  });
  if (status !== "failed" && markSent) {
    await admin.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", appointmentId);
  }
  return { status };
}

/** Rotina diária: lembretes das consultas de amanhã e parabéns dos aniversariantes de hoje. */
export async function runDailyMessages({ now = new Date(), clinicId }: { now?: Date; clinicId?: string } = {}) {
  const admin = createAdminClient();
  const today = todayIso(now);
  const tomorrow = addDays(today, 1);
  const summary = { reminders: 0, birthdays: 0, returns: 0, dunning: 0, failed: 0 };

  let appointmentsQuery = admin
    .from("appointments")
    .select("id")
    .in("status", ["scheduled", "confirmed"])
    .is("reminder_sent_at", null)
    .neq("reminder_mode", "none")
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
  // Alertas de retorno que vencem hoje (ou venceram e ainda não foram avisados).
  let returnsQuery = admin
    .from("patient_returns")
    .select("id, clinic_id, patient_id, patients(full_name, whatsapp, phone), clinics(name)")
    .eq("status", "pending")
    .is("notified_at", null)
    .lte("due_date", today);
  if (clinicId) returnsQuery = returnsQuery.eq("clinic_id", clinicId);
  const { data: dueReturns } = await returnsQuery;
  for (const r of dueReturns ?? []) {
    const body = await templateFor(admin, r.clinic_id, "return_reminder");
    if (!body) continue;
    const status = await deliver(admin, {
      clinicId: r.clinic_id,
      patientId: r.patient_id,
      kind: "return_reminder",
      phone: r.patients?.whatsapp ?? r.patients?.phone ?? null,
      body,
      variables: { paciente: firstName(r.patients?.full_name ?? ""), clinica: r.clinics?.name ?? "" },
    });
    if (status !== "failed") await admin.from("patient_returns").update({ notified_at: new Date().toISOString() }).eq("id", r.id);
    if (status === "failed") summary.failed++;
    else summary.returns++;
  }

  const dunning = await runDunning(admin, today, clinicId);
  summary.dunning += dunning.sent;
  summary.failed += dunning.failed;

  const reviews = await runReviewRequests(admin, now, clinicId);
  summary.failed += reviews.failed;

  return { ...summary, reviews: reviews.sent };
}

/** Um pedido de avaliação por paciente a cada 90 dias, no máximo. */
const REVIEW_COOLDOWN_DAYS = 90;
/** Consultas atendidas há mais tempo que isso não recebem mais o pedido. */
const REVIEW_MAX_AGE_DAYS = 3;

/**
 * Pedido de avaliação no Google (P10): consultas "Atendido" há pelo menos X
 * horas (configurado pela clínica), com o modelo ligado e o link cadastrado.
 * Roda junto da rotina diária, então o "X horas" é o mínimo, não a hora exata.
 */
export async function runReviewRequests(admin: Admin, now: Date = new Date(), clinicId?: string) {
  const result = { sent: 0, failed: 0 };
  let templatesQuery = admin.from("message_templates").select("clinic_id, body").eq("kind", "review_request").eq("active", true);
  if (clinicId) templatesQuery = templatesQuery.eq("clinic_id", clinicId);
  const { data: templates } = await templatesQuery;
  for (const t of templates ?? []) {
    const { data: clinic } = await admin.from("clinics").select("name, google_review_url, review_request_delay_hours").eq("id", t.clinic_id).single();
    if (!clinic?.google_review_url) continue;
    const until = new Date(now.getTime() - clinic.review_request_delay_hours * 3_600_000).toISOString();
    const since = new Date(now.getTime() - REVIEW_MAX_AGE_DAYS * 86_400_000).toISOString();
    const { data: appointments } = await admin
      .from("appointments")
      .select("id, patient_id, patients(full_name, whatsapp, phone)")
      .eq("clinic_id", t.clinic_id)
      .eq("status", "done")
      .is("review_requested_at", null)
      .lte("ends_at", until)
      .gte("ends_at", since);
    const handled = new Set<string>();
    for (const a of appointments ?? []) {
      // Marca a consulta de qualquer jeito: não volta a ser avaliada amanhã.
      await admin.from("appointments").update({ review_requested_at: now.toISOString() }).eq("id", a.id);
      if (handled.has(a.patient_id)) continue;
      handled.add(a.patient_id);
      const { count } = await admin
        .from("messages_log")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", a.patient_id)
        .eq("template_kind", "review_request")
        .neq("status", "failed")
        .gte("sent_at", new Date(now.getTime() - REVIEW_COOLDOWN_DAYS * 86_400_000).toISOString());
      if (count) continue;
      const status = await deliver(admin, {
        clinicId: t.clinic_id,
        patientId: a.patient_id,
        appointmentId: a.id,
        kind: "review_request",
        phone: a.patients?.whatsapp ?? a.patients?.phone ?? null,
        body: t.body,
        variables: { paciente: firstName(a.patients?.full_name ?? ""), clinica: clinic.name, link: clinic.google_review_url },
      });
      if (status === "failed") result.failed++;
      else result.sent++;
    }
  }
  return result;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Régua de cobrança: para cada etapa ativa (dias em relação ao vencimento),
 * avisa as parcelas em aberto que caem nela hoje. Uma vez por parcela e etapa;
 * parcela paga, cancelada ou em negociação não recebe.
 */
export async function runDunning(admin: Admin, today: string, clinicId?: string) {
  const result = { sent: 0, failed: 0 };
  let stepsQuery = admin.from("dunning_steps").select("clinic_id, offset_days, body").eq("active", true);
  if (clinicId) stepsQuery = stepsQuery.eq("clinic_id", clinicId);
  const { data: steps } = await stepsQuery;
  for (const step of steps ?? []) {
    const due = addDays(today, -step.offset_days);
    const { data: receivables } = await admin
      .from("receivables")
      .select("id, patient_id, amount_cents, due_date, patients(full_name, whatsapp, phone), clinics(name)")
      .eq("clinic_id", step.clinic_id)
      .in("status", ["open", "overdue"])
      .eq("in_negotiation", false)
      .eq("due_date", due);
    if (!receivables?.length) continue;
    const { data: done } = await admin
      .from("dunning_log")
      .select("receivable_id")
      .eq("offset_days", step.offset_days)
      .in("receivable_id", receivables.map((r) => r.id));
    const already = new Set((done ?? []).map((d) => d.receivable_id));
    for (const r of receivables) {
      if (already.has(r.id)) continue;
      const { data: charge } = await admin
        .from("patient_charges")
        .select("invoice_url")
        .eq("clinic_id", step.clinic_id)
        .in("status", ["pending", "overdue"])
        .contains("receivable_ids", [r.id])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const status = await deliver(admin, {
        clinicId: step.clinic_id,
        patientId: r.patient_id,
        kind: "payment_reminder",
        phone: r.patients?.whatsapp ?? r.patients?.phone ?? null,
        body: step.body,
        variables: {
          paciente: firstName(r.patients?.full_name ?? ""),
          clinica: r.clinics?.name ?? "",
          valor: brl.format(r.amount_cents / 100),
          vencimento: r.due_date.split("-").reverse().join("/"),
          link: charge?.invoice_url ? `Pague por aqui: ${charge.invoice_url}` : "",
        },
      });
      await admin.from("dunning_log").insert({ clinic_id: step.clinic_id, receivable_id: r.id, offset_days: step.offset_days, status });
      if (status === "failed") result.failed++;
      else result.sent++;
    }
  }
  return result;
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
