"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/** Grava no perfil até que data a pessoa já viu as novidades (o ponto no menu some). */
export async function markNewsSeen(latest: string): Promise<void> {
  if (!z.iso.date().safeParse(latest).success) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("profiles").update({ news_seen_at: `${latest}T23:59:59-03:00` }).eq("id", auth.user.id);
  revalidatePath("/", "layout");
}
