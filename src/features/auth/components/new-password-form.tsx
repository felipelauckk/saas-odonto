"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/action-state";

import { updatePassword } from "../actions";

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, idleState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormField
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Pelo menos 8 caracteres, com letras e números."
        errors={state.fieldErrors?.password}
      />
      <FormField
        label="Repita a nova senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton className="w-full" size="lg" pendingLabel="Salvando...">
        Salvar senha
      </SubmitButton>
    </form>
  );
}
