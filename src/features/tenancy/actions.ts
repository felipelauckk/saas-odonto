"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { ACTIVE_UNIT_COOKIE } from "./constants";

const idSchema = z.uuid();

export async function switchClinic(clinicId: string): Promise<{ error?: string }> {
  const parsed = idSchema.safeParse(clinicId);
  if (!parsed.success) return { error: "Clínica inválida." };

  const supabase = await createClient();
  // set_active_clinic recusa clínicas das quais o usuário não é membro.
  const { error } = await supabase.rpc("set_active_clinic", { _clinic_id: parsed.data });
  if (error) return { error: "Você não tem acesso a esta clínica." };

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_UNIT_COOKIE);
  revalidatePath("/", "layout");
  return {};
}

export async function switchUnit(unitId: string): Promise<{ error?: string }> {
  const parsed = idSchema.safeParse(unitId);
  if (!parsed.success) return { error: "Unidade inválida." };

  const supabase = await createClient();
  // A RLS só devolve a unidade se ela for da clínica ativa e permitida ao usuário.
  const { data } = await supabase.from("units").select("id").eq("id", parsed.data).maybeSingle();
  if (!data) return { error: "Você não tem acesso a esta unidade." };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_UNIT_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return {};
}
