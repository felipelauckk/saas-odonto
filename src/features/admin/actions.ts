"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formValues, type ActionState } from "@/lib/action-state";
import { parseBRLToCents } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function isPlatformAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}

const optionalLimit = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive("Use um número maior que zero.").nullable());

const planSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  price: z.string().transform((v, ctx) => {
    const cents = parseBRLToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido." });
      return z.NEVER;
    }
    return cents;
  }),
  maxUnits: optionalLimit,
  maxProfessionals: optionalLimit,
  active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function savePlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isPlatformAdmin())) return { status: "error", message: "Acesso negado." };
  const values = formValues(formData);
  const parsed = planSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const { id, name, price, maxUnits, maxProfessionals, active } = parsed.data;
  const row = { name, price_cents: price, max_units: maxUnits, max_professionals: maxProfessionals, active };
  const admin = createAdminClient();
  const { error } = id ? await admin.from("plans").update(row).eq("id", id) : await admin.from("plans").insert(row);
  if (error) return { status: "error", message: "Não foi possível salvar o plano.", values };
  revalidatePath("/admin/planos");
  return { status: "success", message: "Plano salvo." };
}

const clinicUpdateSchema = z.object({
  clinicId: z.uuid(),
  action: z.enum(["extend_trial_7", "extend_trial_14", "set_active", "set_canceled", "set_trialing", "set_plan"]),
  planId: z.uuid().nullable().optional(),
});

/** Ajustes manuais (cortesia, suporte). Não mexe na cobrança do Asaas. */
export async function updateClinicSubscription(input: z.input<typeof clinicUpdateSchema>): Promise<{ error?: string }> {
  if (!(await isPlatformAdmin())) return { error: "Acesso negado." };
  const parsed = clinicUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const admin = createAdminClient();
  const { clinicId, action, planId } = parsed.data;
  const { data: clinic } = await admin.from("clinics").select("trial_ends_at").eq("id", clinicId).single();
  if (!clinic) return { error: "Clínica não encontrada." };

  const base = clinic.trial_ends_at && new Date(clinic.trial_ends_at) > new Date() ? new Date(clinic.trial_ends_at) : new Date();
  const extend = (days: number) => new Date(base.getTime() + days * 86_400_000).toISOString();
  const changes =
    action === "extend_trial_7" || action === "extend_trial_14"
      ? { subscription_status: "trialing" as const, trial_ends_at: extend(action === "extend_trial_7" ? 7 : 14), past_due_since: null }
      : action === "set_active"
        ? { subscription_status: "active" as const, past_due_since: null, canceled_at: null }
        : action === "set_canceled"
          ? { subscription_status: "canceled" as const, canceled_at: new Date().toISOString() }
          : action === "set_trialing"
            ? { subscription_status: "trialing" as const }
            : { plan_id: planId ?? null };

  const { error } = await admin.from("clinics").update(changes).eq("id", clinicId);
  if (error) return { error: "Não foi possível atualizar." };
  revalidatePath("/admin", "layout");
  return {};
}
