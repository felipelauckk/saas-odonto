import "server-only";

import { firstName, renderTemplate } from "@/lib/messaging/render";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, utcToZoned } from "@/lib/timezone";

import { localPhone, sendToConversation } from "./assistant";

type Admin = ReturnType<typeof createAdminClient>;
type Target = { queue: "open_quotes" | "no_shows" | "untreated" | "overdue_returns"; itemKey: string; patientId: string; refId: string | null; amountCents: number | null };

/** Horário comercial: segunda a sexta, 9h às 18h (Brasília). */
export function isBusinessHours(now = new Date()): boolean {
  const z = utcToZoned(now);
  const weekday = new Date(`${z.date}T12:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5 && z.minutes >= 9 * 60 && z.minutes < 18 * 60;
}

/** Itens das filas da CRC que o follow-up pode trabalhar (versão do servidor, por clínica). */
async function targets(admin: Admin, clinicId: string, queues: string[], today: string): Promise<Target[]> {
  const out: Target[] = [];
  const nowIso = new Date().toISOString();
  const { data: future } = await admin.from("appointments").select("patient_id").eq("clinic_id", clinicId).gt("starts_at", nowIso).not("status", "in", "(canceled,no_show)");
  const booked = new Set((future ?? []).map((a) => a.patient_id));
  if (queues.includes("open_quotes")) {
    const { data } = await admin.from("treatment_plans").select("id, patient_id, total_cents, presented_at").eq("clinic_id", clinicId).eq("status", "presented").lte("presented_at", addDays(today, -2));
    for (const p of data ?? []) out.push({ queue: "open_quotes", itemKey: `plan:${p.id}`, patientId: p.patient_id, refId: p.id, amountCents: p.total_cents });
  }
  if (queues.includes("overdue_returns")) {
    const { data } = await admin.from("patient_returns").select("id, patient_id").eq("clinic_id", clinicId).eq("status", "pending").lte("due_date", today);
    for (const r of data ?? []) if (!booked.has(r.patient_id)) out.push({ queue: "overdue_returns", itemKey: `return:${r.id}`, patientId: r.patient_id, refId: r.id, amountCents: null });
  }
  if (queues.includes("no_shows")) {
    const { data } = await admin.from("appointments").select("id, patient_id, starts_at").eq("clinic_id", clinicId).eq("status", "no_show").gte("starts_at", addDays(today, -30)).order("starts_at", { ascending: false });
    const seen = new Set<string>();
    for (const a of data ?? []) {
      if (seen.has(a.patient_id) || booked.has(a.patient_id)) continue;
      seen.add(a.patient_id);
      out.push({ queue: "no_shows", itemKey: `appt:${a.id}`, patientId: a.patient_id, refId: a.id, amountCents: null });
    }
  }
  if (queues.includes("untreated")) {
    const { data } = await admin.from("treatment_plans").select("id, patient_id, treatment_items(status, price_cents)").eq("clinic_id", clinicId).in("status", ["approved", "partially_approved"]);
    for (const p of data ?? []) {
      const pending = p.treatment_items.filter((i) => i.status === "approved");
      if (pending.length && !booked.has(p.patient_id)) out.push({ queue: "untreated", itemKey: `plan:${p.id}`, patientId: p.patient_id, refId: p.id, amountCents: pending.reduce((s, i) => s + i.price_cents, 0) });
    }
  }
  return out;
}

/**
 * Follow-up automático das filas da CRC pelo WhatsApp: manda a mensagem da
 * fila (Configurações > Mensagens > CRC) uma vez por paciente a cada X dias,
 * só em horário comercial. As respostas caem no assistente/caixa de entrada.
 */
export async function runFollowups({ clinicId, now = new Date(), limitPerClinic = 30 }: { clinicId?: string; now?: Date; limitPerClinic?: number } = {}) {
  const summary = { sent: 0, skipped: 0 };
  if (!isBusinessHours(now)) return summary;
  const admin = createAdminClient();
  let q = admin.from("clinic_ai_settings").select("clinic_id, followup_queues, followup_min_days").eq("followup_enabled", true);
  if (clinicId) q = q.eq("clinic_id", clinicId);
  const { data: clinics } = await q;
  const today = utcToZoned(now).date;
  for (const c of clinics ?? []) {
    const [{ data: clinic }, { data: templates }] = await Promise.all([
      admin.from("clinics").select("name").eq("id", c.clinic_id).single(),
      admin.from("crc_templates").select("queue, body").eq("clinic_id", c.clinic_id),
    ]);
    const since = new Date(now.getTime() - c.followup_min_days * 86_400_000).toISOString();
    const { data: recent } = await admin.from("crc_contacts").select("patient_id").eq("clinic_id", c.clinic_id).gte("created_at", since);
    const contacted = new Set((recent ?? []).map((r) => r.patient_id));
    let sent = 0;
    for (const t of await targets(admin, c.clinic_id, c.followup_queues, today)) {
      if (sent >= limitPerClinic) break;
      if (contacted.has(t.patientId)) {
        summary.skipped++;
        continue;
      }
      const body = templates?.find((x) => x.queue === t.queue)?.body;
      const { data: patient } = await admin.from("patients").select("full_name, whatsapp, phone, archived_at").eq("id", t.patientId).single();
      const phone = localPhone(patient?.whatsapp ?? patient?.phone ?? "");
      if (!body || !patient || patient.archived_at || !phone) {
        summary.skipped++;
        continue;
      }
      const text = renderTemplate(body, { paciente: firstName(patient.full_name), clinica: clinic?.name ?? "", valor: t.amountCents ? (t.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : undefined });
      const { data: existing } = await admin.from("whatsapp_conversations").select("id, clinic_id, phone, patient_id, mode, unread").eq("clinic_id", c.clinic_id).eq("phone", phone).maybeSingle();
      const conversation = existing ?? (await admin.from("whatsapp_conversations").insert({ clinic_id: c.clinic_id, phone, patient_id: t.patientId }).select("id, clinic_id, phone, patient_id, mode, unread").single()).data;
      if (!conversation) continue;
      await sendToConversation(conversation, "bot", text);
      await admin.from("crc_contacts").insert({ clinic_id: c.clinic_id, patient_id: t.patientId, queue: t.queue, item_key: t.itemKey, ref_id: t.refId, channel: "whatsapp", notes: "Follow-up automático do assistente.", amount_cents: t.amountCents });
      contacted.add(t.patientId);
      sent++;
      summary.sent++;
    }
  }
  return summary;
}
