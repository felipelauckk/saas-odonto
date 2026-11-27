"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type NotificationItem = { id: string; kind: string; title: string; body: string | null; link: string | null; createdAt: string; read: boolean };

/** Últimas notificações da pessoa (a RLS só devolve as dela) e quantas não leu. */
export async function loadNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const supabase = await createClient();
  const [{ data: rows }, { data: reads }] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, link, created_at").order("created_at", { ascending: false }).limit(40),
    supabase.from("notification_reads").select("notification_id").order("read_at", { ascending: false }).limit(500),
  ]);
  const readIds = new Set((reads ?? []).map((r) => r.notification_id));
  const items = (rows ?? []).map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, createdAt: n.created_at, read: readIds.has(n.id) }));
  return { items, unread: items.filter((i) => !i.read).length };
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) return;
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  if (!clinicId) return;
  await supabase.from("notification_reads").upsert({ notification_id: id, clinic_id: clinicId }, { onConflict: "notification_id,user_id", ignoreDuplicates: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");
}
