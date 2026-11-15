"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

type Props = {
  token: string;
  source: string;
  campaignId: string | null;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

export function PublicLeadForm({ token, source, campaignId, action }: Props) {
  const [state, formAction] = useActionState(action, { status: "idle" } as ActionState);
  const [startedAt] = useState(() => Date.now());
  if (state.status === "success") {
    return <FormMessage state={state} />;
  }
  const v = state.status === "error" ? state.values : undefined;
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="source" value={source} />
      {campaignId ? <input type="hidden" name="campaignId" value={campaignId} /> : null}
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Campo-armadilha: pessoas não veem, robôs preenchem. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="website">Site</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <FormField label="Nome" name="name" required autoComplete="name" defaultValue={v?.name ?? ""} errors={state.fieldErrors?.name} />
      <FormField label="WhatsApp ou telefone" name="phone" required inputMode="tel" autoComplete="tel" placeholder="(11) 98888-7777" defaultValue={v?.phone ?? ""} errors={state.fieldErrors?.phone} />
      <FormField label="O que você procura? (opcional)" name="interest" placeholder="Ex.: clareamento, implante, avaliação" defaultValue={v?.interest ?? ""} errors={state.fieldErrors?.interest} />
      <div className="space-y-1.5">
        <Label htmlFor="message">Mensagem (opcional)</Label>
        <Textarea id="message" name="message" maxLength={1000} defaultValue={v?.message ?? ""} />
      </div>
      <p className="text-xs text-muted-foreground">Seus dados são usados só para a clínica entrar em contato com você.</p>
      <SubmitButton className="w-full">Quero ser contatado</SubmitButton>
    </form>
  );
}
