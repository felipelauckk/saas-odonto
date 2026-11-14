"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { formValues, withoutSecrets, type ActionState } from "@/lib/action-state";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

import {
  newPasswordSchema,
  recoverPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

function invalid(error: z.ZodError, values: Record<string, string>): ActionState {
  return {
    status: "error",
    message: "Confira os campos destacados.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: withoutSecrets(values),
  };
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { clinicName, fullName, email, whatsapp, password } = parsed.data;
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirmar?next=/painel`,
      // O gatilho handle_new_user cria clínica, unidade e vínculo de owner.
      data: { full_name: fullName, phone: whatsapp, clinic_name: clinicName },
    },
  });

  if (error) {
    return {
      status: "error",
      message:
        error.code === "over_email_send_rate_limit"
          ? "Muitos cadastros em pouco tempo. Aguarde alguns minutos e tente de novo."
          : error.code === "weak_password"
            ? "Senha fraca. Use uma senha mais forte."
            : "Não foi possível concluir o cadastro. Tente novamente.",
      values: withoutSecrets(values),
    };
  }

  // Confirmação de e-mail desligada: já existe sessão.
  if (data.session) redirect("/painel");

  return {
    status: "success",
    message: `Enviamos um link de confirmação para ${email}. Abra o e-mail para ativar sua conta.`,
  };
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message:
        error.code === "email_not_confirmed"
          ? "Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada."
          : "E-mail ou senha incorretos.",
      values: { email: parsed.data.email },
    };
  }

  redirect(safeRedirectPath(values.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = recoverPasswordSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirmar?next=/nova-senha`,
  });

  if (error?.code === "over_email_send_rate_limit") {
    return {
      status: "error",
      message: "Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.",
      values,
    };
  }

  // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
  return {
    status: "success",
    message: `Se houver uma conta com ${parsed.data.email}, enviamos um link para criar uma nova senha.`,
  };
}

export async function updatePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = newPasswordSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      status: "error",
      message:
        error.code === "same_password"
          ? "A nova senha precisa ser diferente da atual."
          : error.code === "weak_password"
            ? "Senha fraca. Use uma senha mais forte."
            : "Não foi possível salvar a senha. Abra o link do e-mail de novo.",
    };
  }

  redirect("/painel");
}
