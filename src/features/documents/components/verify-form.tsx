"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/action-state";

import { verifyPdf } from "../actions";

/** Confere se um PDF é exatamente o que a clínica emitiu/assinou (hash SHA-256). */
export function VerifyForm() {
  const [state, action] = useActionState(verifyPdf, idleState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      {state.values?.hash ? <p className="break-all font-mono text-xs text-muted-foreground">SHA-256: {state.values.hash}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="verify-file">Arquivo PDF</Label>
        <Input id="verify-file" name="arquivo" type="file" accept="application/pdf" />
      </div>
      <SubmitButton variant="outline" pendingLabel="Conferindo...">
        Verificar documento
      </SubmitButton>
    </form>
  );
}
