"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formValues, type ActionState } from "@/lib/action-state";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

import { inviteMemberSchema, updateMemberSchema } from "./schemas";

const MEMBERS_PATH = "/configuracoes/membros";

/**
 * Convida alguém para a clínica ativa.
 * - E-mail novo: o Supabase cria a conta e envia o convite (link para criar senha).
 * - Quem já tem conta: só ganha o vínculo e passa a ver a clínica no seletor.
 * O vínculo é gravado com o cliente do usuário, então a RLS confere a permissão.
 */
export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = inviteMemberSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }
  const { fullName, email, role } = parsed.data;

  const session = await getSessionContext();
  const clinic = session?.clinic;
  if (!clinic || !canManageClinic(clinic.role)) {
    return { status: "error", message: "Você não tem permissão para convidar pessoas.", values };
  }
  if (role === "owner" && clinic.role !== "owner") {
    return { status: "error", message: "Só um proprietário pode convidar outro proprietário.", values };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: existingUserId, error: lookupError } = await admin.rpc("find_user_id_by_email", {
    _email: email,
  });
  if (lookupError) {
    return { status: "error", message: "Não foi possível enviar o convite. Tente novamente.", values };
  }

  let userId = existingUserId;
  let createdNow = false;

  if (userId) {
    const { data: membership } = await supabase
      .from("clinic_members")
      .select("id, active")
      .eq("clinic_id", clinic.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (membership?.active) {
      return { status: "error", message: `${email} já faz parte da equipe.`, values };
    }
    if (membership) {
      const { data: reactivated, error } = await supabase
        .from("clinic_members")
        .update({ active: true, role })
        .eq("id", membership.id)
        .select("id");
      if (error || !reactivated?.length) {
        return { status: "error", message: "Não foi possível reativar este membro.", values };
      }
      revalidatePath(MEMBERS_PATH);
      return { status: "success", message: `${email} voltou para a equipe.` };
    }
  } else {
    const siteUrl = await getSiteUrl();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${siteUrl}/auth/confirmar?next=/nova-senha`,
    });
    if (error || !data.user) {
      return {
        status: "error",
        message:
          error?.code === "over_email_send_rate_limit"
            ? "Limite de e-mails atingido. Aguarde alguns minutos e tente de novo."
            : "Não foi possível enviar o convite. Tente novamente.",
        values,
      };
    }
    userId = data.user.id;
    createdNow = true;
  }

  const { error: insertError } = await supabase
    .from("clinic_members")
    .insert({ clinic_id: clinic.id, user_id: userId, role });

  if (insertError) {
    // Não deixa conta órfã se o vínculo falhou.
    if (createdNow) await admin.auth.admin.deleteUser(userId);
    return { status: "error", message: "Não foi possível adicionar este membro.", values };
  }

  revalidatePath(MEMBERS_PATH);
  return {
    status: "success",
    message: createdNow
      ? `Convite enviado para ${email}.`
      : `${email} já tinha conta e foi adicionado. A clínica aparece no seletor de clínicas dessa pessoa.`,
  };
}

/** Muda o papel ou ativa/desativa um membro da clínica ativa. */
export async function updateMember(input: z.input<typeof updateMemberSchema>): Promise<{ error?: string }> {
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const { memberId, role, active } = parsed.data;

  const session = await getSessionContext();
  const clinic = session?.clinic;
  if (!session || !clinic || !canManageClinic(clinic.role)) {
    return { error: "Você não tem permissão para alterar a equipe." };
  }
  if (role === "owner" && clinic.role !== "owner") {
    return { error: "Só um proprietário pode tornar alguém proprietário." };
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("clinic_members")
    .select("user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return { error: "Membro não encontrado." };
  if (member.user_id === session.user.id) return { error: "Você não pode alterar o próprio acesso." };

  const changes: { role?: typeof role; active?: boolean } = {};
  if (role) changes.role = role;
  if (active !== undefined) changes.active = active;

  const { data, error } = await supabase
    .from("clinic_members")
    .update(changes)
    .eq("id", memberId)
    .select("id");

  if (error?.code === "23514") return { error: "A clínica precisa ter pelo menos um proprietário ativo." };
  if (error || !data?.length) return { error: "Você não tem permissão para alterar este membro." };

  revalidatePath(MEMBERS_PATH);
  return {};
}
