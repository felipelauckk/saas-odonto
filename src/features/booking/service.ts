import "server-only";

import { randomInt } from "node:crypto";

import { getMessagingProvider, isMessagingConfigured } from "@/lib/messaging";
import { toWhatsAppNumber } from "@/lib/messaging/render";
import { sha256Hex } from "@/lib/hash";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/timezone";

import { freeSlots, mergeAnyProfessional, type Busy, type Slot } from "./slots";

type Admin = ReturnType<typeof createAdminClient>;

export type BookingPage = {
  clinicId: string;
  clinicName: string;
  slug: string;
  intro: string | null;
  units: { id: string; name: string }[];
  professionals: { id: string; name: string }[];
  procedures: { id: string; name: string; durationMin: number }[];
  defaultDurationMin: number;
  minNoticeHours: number;
  maxDaysAhead: number;
};

/** Dados públicos da página de agendamento (nada de paciente). */
export async function loadBookingPage(slug: string): Promise<BookingPage | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const admin = createAdminClient();
  const { data: s } = await admin.from("online_booking_settings").select("*").eq("slug", slug).eq("enabled", true).maybeSingle();
  return s ? buildPage(admin, s) : null;
}

/** Mesma configuração, pela clínica (o assistente de WhatsApp agenda mesmo com a página desligada). */
export async function loadBookingForClinic(clinicId: string): Promise<BookingPage | null> {
  const admin = createAdminClient();
  const { data: s } = await admin.from("online_booking_settings").select("*").eq("clinic_id", clinicId).maybeSingle();
  return s ? buildPage(admin, s) : null;
}

type SettingsRow = Database["public"]["Tables"]["online_booking_settings"]["Row"];

async function buildPage(admin: Admin, s: SettingsRow): Promise<BookingPage | null> {
  const [{ data: clinic }, { data: units }, { data: pros }, { data: procs }] = await Promise.all([
    admin.from("clinics").select("name").eq("id", s.clinic_id).single(),
    admin.from("units").select("id, name").eq("clinic_id", s.clinic_id).eq("active", true).order("name"),
    admin.from("professionals").select("id, name").eq("clinic_id", s.clinic_id).eq("active", true).order("name"),
    s.procedure_ids.length
      ? admin.from("procedures").select("id, name, duration_min").eq("clinic_id", s.clinic_id).eq("active", true).in("id", s.procedure_ids).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string; duration_min: number }[] }),
  ]);
  if (!clinic) return null;
  const allowed = new Set(s.professional_ids);
  return {
    clinicId: s.clinic_id,
    clinicName: clinic.name,
    slug: s.slug,
    intro: s.intro,
    units: units ?? [],
    professionals: (pros ?? []).filter((p) => !allowed.size || allowed.has(p.id)),
    procedures: (procs ?? []).map((p) => ({ id: p.id, name: p.name, durationMin: p.duration_min })),
    defaultDurationMin: s.default_duration_min,
    minNoticeHours: s.min_notice_hours,
    maxDaysAhead: s.max_days_ahead,
  };
}

const FREEING = ["canceled", "no_show"];

export async function computeSlots(admin: Admin, page: BookingPage, input: { unitId: string; professionalId: string | null; durationMin: number; from: string; days: number }) {
  const proIds = input.professionalId ? [input.professionalId] : page.professionals.map((p) => p.id);
  if (!proIds.length) return [];
  const start = zonedToUtc(input.from, "00:00").toISOString();
  const end = zonedToUtc(addDays(input.from, input.days), "00:00").toISOString();
  const [{ data: schedules }, { data: appts }, { data: blocks }] = await Promise.all([
    admin.from("professional_schedules").select("professional_id, weekday, start_time, end_time").eq("unit_id", input.unitId).in("professional_id", proIds),
    admin.from("appointments").select("professional_id, starts_at, ends_at, status").in("professional_id", proIds).lt("starts_at", end).gt("ends_at", start),
    admin.from("schedule_blocks").select("professional_id, starts_at, ends_at").eq("unit_id", input.unitId).eq("kind", "block").lt("starts_at", end).gt("ends_at", start),
  ]);
  const busyByProfessional = new Map<string, Busy[]>();
  const push = (pro: string, from: string, to: string) => busyByProfessional.set(pro, [...(busyByProfessional.get(pro) ?? []), { start: Date.parse(from), end: Date.parse(to) }]);
  for (const a of appts ?? []) if (!FREEING.includes(a.status)) push(a.professional_id, a.starts_at, a.ends_at);
  const unitBusy: Busy[] = [];
  for (const b of blocks ?? []) {
    if (b.professional_id) push(b.professional_id, b.starts_at, b.ends_at);
    else unitBusy.push({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) });
  }
  return freeSlots({
    schedules: (schedules ?? []).map((s) => ({ professionalId: s.professional_id, weekday: s.weekday, start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) })),
    busyByProfessional,
    unitBusy,
    durationMin: input.durationMin,
    from: input.from,
    days: input.days,
    now: Date.now(),
    minNoticeHours: page.minNoticeHours,
  });
}

function durationFor(page: BookingPage, procedureId: string | null) {
  return page.procedures.find((p) => p.id === procedureId)?.durationMin ?? page.defaultDurationMin;
}

/** Horários livres de uma semana a partir de `from` (dentro do limite de dias à frente). */
export async function listSlots(slug: string, input: { unitId: string; professionalId: string | null; procedureId: string | null; from: string }): Promise<Slot[] | null> {
  return slotsForPage(await loadBookingPage(slug), input);
}

export async function slotsForPage(page: BookingPage | null, input: { unitId: string; professionalId: string | null; procedureId: string | null; from: string }): Promise<Slot[] | null> {
  if (!page || !page.units.some((u) => u.id === input.unitId)) return null;
  if (input.professionalId && !page.professionals.some((p) => p.id === input.professionalId)) return null;
  const today = utcToZoned(new Date()).date;
  const last = addDays(today, page.maxDaysAhead);
  const from = input.from < today ? today : input.from;
  if (from > last) return [];
  const days = Math.min(7, Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1);
  const slots = await computeSlots(createAdminClient(), page, { ...input, durationMin: durationFor(page, input.procedureId), from, days });
  return input.professionalId ? slots : mergeAnyProfessional(slots);
}

export type BookingPayload = { unitId: string; professionalId: string; procedureId: string | null; startsAt: string; endsAt: string; name: string; phone: string };

/**
 * Pede o agendamento: confere o horário, guarda o pedido e manda o código de
 * 6 dígitos pelo WhatsApp. Sem WhatsApp configurado (teste), devolve o código.
 */
export async function requestBooking(slug: string, input: { unitId: string; professionalId: string | null; procedureId: string | null; startsAt: string; name: string; phone: string }): Promise<{ error?: string; requestId?: string; devCode?: string }> {
  const page = await loadBookingPage(slug);
  if (!page) return { error: "Agendamento online indisponível." };
  const admin = createAdminClient();
  const day = utcToZoned(input.startsAt).date;
  const slots = await computeSlots(admin, page, {
    unitId: input.unitId,
    professionalId: input.professionalId,
    durationMin: durationFor(page, input.procedureId),
    from: day,
    days: 1,
  });
  const slot = slots.find((s) => s.startsAt === new Date(input.startsAt).toISOString() && (!input.professionalId || s.professionalId === input.professionalId));
  if (!slot) return { error: "Esse horário acabou de ser ocupado. Escolha outro." };

  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await admin.from("booking_requests").select("id", { count: "exact", head: true }).eq("clinic_id", page.clinicId).eq("phone", input.phone).gte("created_at", since);
  if ((count ?? 0) >= 3) return { error: "Muitos pedidos com este telefone. Tente de novo mais tarde ou ligue para a clínica." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const payload: BookingPayload = { unitId: input.unitId, professionalId: slot.professionalId, procedureId: input.procedureId, startsAt: slot.startsAt, endsAt: slot.endsAt, name: input.name, phone: input.phone };
  const { data: req, error } = await admin
    .from("booking_requests")
    .insert({ clinic_id: page.clinicId, phone: input.phone, code_hash: sha256Hex(`${code}:${input.phone}`), payload, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() })
    .select("id")
    .single();
  if (error) return { error: "Não foi possível registrar o pedido. Tente de novo." };

  const to = toWhatsAppNumber(input.phone);
  const text = `Seu código para confirmar o agendamento na ${page.clinicName} é ${code}. Ele vale por 10 minutos.`;
  if (to) {
    await getMessagingProvider()
      .send({ to, kind: "booking_code", text, variables: { paciente: input.name.split(" ")[0] ?? input.name, clinica: page.clinicName, codigo: code } })
      .catch(() => undefined);
  }
  return { requestId: req.id, devCode: isMessagingConfigured() ? undefined : code };
}

/** Confere o código e cria a consulta (e o paciente e o lead, se for novo). */
export async function confirmBooking(slug: string, requestId: string, code: string): Promise<{ error?: string; when?: string; professionalName?: string; unitName?: string }> {
  const page = await loadBookingPage(slug);
  if (!page) return { error: "Agendamento online indisponível." };
  const admin = createAdminClient();
  const { data: req } = await admin.from("booking_requests").select("*").eq("id", requestId).eq("clinic_id", page.clinicId).maybeSingle();
  if (!req || req.confirmed_at) return { error: "Pedido não encontrado. Comece de novo." };
  if (Date.parse(req.expires_at) < Date.now()) return { error: "O código expirou. Peça um novo." };
  if (req.attempts >= 5) return { error: "Muitas tentativas. Peça um novo código." };
  if (sha256Hex(`${code.trim()}:${req.phone}`) !== req.code_hash) {
    await admin.from("booking_requests").update({ attempts: req.attempts + 1 }).eq("id", req.id);
    return { error: "Código incorreto." };
  }
  const p = req.payload as BookingPayload;

  const created = await createBookedAppointment(page, p, "Agendado pelo paciente na página de agendamento online.");
  if ("error" in created) return { error: created.error };
  const appt = { id: created.appointmentId };
  await admin.from("booking_requests").update({ confirmed_at: new Date().toISOString(), appointment_id: appt.id }).eq("id", req.id);

  const when = utcToZoned(p.startsAt);
  return {
    when: `${when.date.split("-").reverse().join("/")} às ${when.time}`,
    professionalName: page.professionals.find((x) => x.id === p.professionalId)?.name,
    unitName: page.units.find((u) => u.id === p.unitId)?.name,
  };
}

/**
 * Cria a consulta pedida pelo paciente (página online ou assistente de
 * WhatsApp): confere o horário de novo, reaproveita o paciente pelo telefone
 * ou cadastra (com lead no CRM).
 */
export async function createBookedAppointment(page: BookingPage, p: BookingPayload, note: string): Promise<{ error: string } | { appointmentId: string; patientId: string }> {
  const admin = createAdminClient();
  const free = await computeSlots(admin, page, { unitId: p.unitId, professionalId: p.professionalId, durationMin: Math.round((Date.parse(p.endsAt) - Date.parse(p.startsAt)) / 60_000), from: utcToZoned(p.startsAt).date, days: 1 });
  if (!free.some((s) => s.startsAt === new Date(p.startsAt).toISOString() && s.professionalId === p.professionalId)) return { error: "Esse horário acabou de ser ocupado. Escolha outro." };
  // Paciente: reaproveita quem já tem esse telefone; senão cadastra (e cria o lead).
  const { data: existing } = await admin
    .from("patients")
    .select("id")
    .eq("clinic_id", page.clinicId)
    .is("archived_at", null)
    .or(`phone.eq.${p.phone},whatsapp.eq.${p.phone}`)
    .limit(1);
  let patientId = existing?.[0]?.id ?? null;
  if (!patientId) {
    // Origem "Site" da lista da clínica.
    const { data: site } = await admin.from("patient_sources").select("id").eq("clinic_id", page.clinicId).eq("key", "site").maybeSingle();
    const { data: created, error } = await admin.from("patients").insert({ clinic_id: page.clinicId, full_name: p.name, phone: p.phone, whatsapp: p.phone, source_id: site?.id ?? null }).select("id").single();
    if (error) return { error: "Não foi possível concluir. Tente de novo." };
    patientId = created.id;
    const { data: stage } = await admin.from("crm_stages").select("id").eq("clinic_id", page.clinicId).eq("auto_key", "new").maybeSingle();
    if (stage) {
      await admin.from("leads").insert({ clinic_id: page.clinicId, name: p.name, phone: p.phone, source_id: site?.id ?? null, stage_id: stage.id, patient_id: patientId, interest: "Agendou pelo site", from_public_form: true });
    }
  }

  const procedure = page.procedures.find((x) => x.id === p.procedureId);
  const { data: appt, error } = await admin
    .from("appointments")
    .insert({
      clinic_id: page.clinicId,
      unit_id: p.unitId,
      patient_id: patientId,
      professional_id: p.professionalId,
      type: procedure?.name ?? "Agendado online",
      starts_at: p.startsAt,
      ends_at: p.endsAt,
      booked_online: true,
      notes: note,
    })
    .select("id")
    .single();
  if (error) return { error: error.code === "23P01" || error.code === "OB001" ? "Esse horário acabou de ser ocupado. Escolha outro." : "Não foi possível concluir. Tente de novo." };
  // Procedimento escolhido vai para a lista da consulta (appointments.procedure_id não é mais gravado).
  if (procedure) await admin.from("appointment_procedures").insert({ clinic_id: page.clinicId, appointment_id: appt.id, procedure_id: procedure.id });
  return { appointmentId: appt.id, patientId: patientId! };
}
