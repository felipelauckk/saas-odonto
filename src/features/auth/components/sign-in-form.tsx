"use client";

import { useActionState } from "react";
import Link from "next/link";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/action-state";

import { signIn } from "../actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, idleState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <div className="space-y-1.5">
        <FormField
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          errors={state.fieldErrors?.password}
        />
        <div className="text-right">
          <Link
            href="/recuperar-senha"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>
      <SubmitButton className="w-full" size="lg" pendingLabel="Entrando...">
        Entrar
      </SubmitButton>
    </form>
  );
}
