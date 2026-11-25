"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { FormSection, FormSectionsFooter } from "@/components/forms/form-sections";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/action-state";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";

import { updateClinic } from "../actions/clinic";

type ClinicFormProps = {
  clinic: {
    name: string;
    legal_name: string | null;
    document_cnpj_cpf: string | null;
    phone: string | null;
    email: string | null;
  };
};

export function ClinicForm({ clinic }: ClinicFormProps) {
  const [state, action] = useActionState(updateClinic, idleState);
  const v = state.status === "error" ? state.values : undefined;

  // O <form> não desenha nada (contents): os blocos ficam no cartão da página, depois do bloco da logo.
  return (
    <form action={action} className="contents" noValidate>
      <FormSection id="clinica-identificacao" title="Identificação" description="Como a clínica aparece nos orçamentos, recibos e mensagens.">
        <FormMessage state={state} />
        <FormField label="Nome da clínica" name="name" required defaultValue={v?.name ?? clinic.name} errors={state.fieldErrors?.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Razão social" name="legalName" defaultValue={v?.legalName ?? clinic.legal_name ?? ""} errors={state.fieldErrors?.legalName} />
          <FormField
            label="CNPJ ou CPF"
            name="document"
            inputMode="numeric"
            defaultValue={v?.document ?? (clinic.document_cnpj_cpf ? formatCpfCnpj(clinic.document_cnpj_cpf) : "")}
            errors={state.fieldErrors?.document}
          />
        </div>
      </FormSection>
      <FormSection id="clinica-contato" title="Contato" description="Por onde o paciente fala com a clínica.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Telefone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 3333-4444"
            defaultValue={v?.phone ?? (clinic.phone ? formatPhone(clinic.phone) : "")}
            errors={state.fieldErrors?.phone}
          />
          <FormField label="E-mail de contato" name="email" type="email" defaultValue={v?.email ?? clinic.email ?? ""} errors={state.fieldErrors?.email} />
        </div>
      </FormSection>
      <FormSectionsFooter note="O endereço de cada unidade fica em Clínica › Unidades.">
        <SubmitButton pendingLabel="Salvando...">Salvar alterações</SubmitButton>
      </FormSectionsFooter>
    </form>
  );
}
