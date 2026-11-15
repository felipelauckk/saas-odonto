import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/timezone";

import type { CrcQueue } from "./labels";
import { buildBoard, type CrcContact, type CrcItem } from "./logic";

/** Filas da CRC com histórico de contatos e modelos de mensagem. */
export async function getCrcBoard(today: string) {
  const supabase = await createClient();
  const [itemsRes, contactsRes, templatesRes] = await Promise.all([
    supabase.rpc("crc_items"),
    supabase
      .from("crc_contacts")
      .select("id, queue, item_key, channel, outcome, notes, next_contact_on, created_at, created_by")
      .gte("created_at", `${addDays(today, -365)}T00:00:00Z`)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("crc_templates").select("queue, body"),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (contactsRes.error) throw contactsRes.error;

  const authorIds = [...new Set((contactsRes.data ?? []).map((c) => c.created_by).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const items: CrcItem[] = (itemsRes.data ?? []).map((r) => ({
    queue: r.queue,
    itemKey: r.item_key,
    patientId: r.patient_id,
    patientName: r.patient_name,
    phone: r.phone,
    refId: r.ref_id,
    amountCents: r.amount_cents,
    refDate: r.ref_date,
  }));
  const contacts: CrcContact[] = (contactsRes.data ?? []).map((c) => ({
    id: c.id,
    queue: c.queue,
    itemKey: c.item_key,
    channel: c.channel,
    outcome: c.outcome,
    notes: c.notes,
    nextContactOn: c.next_contact_on,
    createdAt: c.created_at,
    authorName: c.created_by ? (nameById.get(c.created_by) ?? null) : null,
  }));
  const templates = Object.fromEntries((templatesRes.data ?? []).map((t) => [t.queue, t.body])) as Partial<Record<CrcQueue, string>>;
  return { ...buildBoard(items, contacts, today), templates };
}

/** Indicadores: contatos por dia e recuperação por fila. */
export async function getCrcStats(from: string, to: string) {
  const supabase = await createClient();
  const [statsRes, contactsRes] = await Promise.all([
    supabase.rpc("crc_stats", { _from: from, _to: to }),
    supabase
      .from("crc_contacts")
      .select("created_at")
      .gte("created_at", `${addDays(from, -1)}T00:00:00Z`)
      .lte("created_at", `${addDays(to, 1)}T23:59:59Z`)
      .limit(20000),
  ]);
  if (statsRes.error) throw statsRes.error;
  if (contactsRes.error) throw contactsRes.error;
  const perDay = new Map<string, number>();
  for (const c of contactsRes.data ?? []) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(c.created_at));
    if (day < from || day > to) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return { byQueue: statsRes.data ?? [], perDay };
}
