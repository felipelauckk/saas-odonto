"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/action-state";

import { signUp } from "../actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, idleState);

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormField
        label="Nome da clínica"
        name="clinicName"
        autoComplete="organization"
        required
        defaultValue={state.values?.clinicName}
        errors={state.fieldErrors?.clinicName}
      />
      <FormField
        label="Seu nome"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
      <FormField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        label="WhatsApp"
        name="whatsapp"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(11) 98888-7777"
        required
        defaultValue={state.values?.whatsapp}
        errors={state.fieldErrors?.whatsapp}
      />
      <FormField
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Pelo menos 8 caracteres, com letras e números."
        errors={state.fieldErrors?.password}
      />
      <SubmitButton className="w-full" size="lg" pendingLabel="Criando conta...">
        Começar teste grátis de 14 dias
      </SubmitButton>
    </form>
  );
}
