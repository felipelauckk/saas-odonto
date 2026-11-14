"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/action-state";

import { requestPasswordReset } from "../actions";

export function RecoverPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, idleState);

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton className="w-full" size="lg" pendingLabel="Enviando...">
        Enviar link
      </SubmitButton>
    </form>
  );
}
