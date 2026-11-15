"use server";

import { submitPublicLeadCore } from "@/features/crm/public-form";
import { formValues, type ActionState } from "@/lib/action-state";

/** Ação pública (sem login): o token do link identifica a clínica. */
export async function submitPublicLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const result = await submitPublicLeadCore(values);
  if (result.error) return { status: "error", message: result.error, fieldErrors: result.fieldErrors, values };
  return { status: "success", message: "Recebemos seu contato! Em breve a clínica fala com você." };
}
