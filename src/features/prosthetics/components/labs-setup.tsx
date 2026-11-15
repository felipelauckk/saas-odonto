"use client";

import { Pencil, Plus } from "lucide-react";

import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/documents";
import { formatCurrency } from "@/lib/format";
import { centsToInput } from "@/lib/money";

import { saveLab, saveLabService } from "../actions";

type Lab = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; notes: string | null; active: boolean };
type Service = { id: string; lab_id: string; name: string; price_cents: number; days: number | null; active: boolean };
type Errors = Partial<Record<string, string[]>> | undefined;

function LabFields({ lab, values, errors }: { lab?: Lab; values?: Record<string, string>; errors: Errors }) {
  return (
    <>
      {lab ? <input type="hidden" name="id" value={lab.id} /> : null}
      <FormField label="Nome" name="name" defaultValue={values?.name ?? lab?.name ?? ""} errors={errors?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Contato" name="contact_name" defaultValue={values?.contact_name ?? lab?.contact_name ?? ""} />
        <FormField label="WhatsApp" name="phone" inputMode="tel" defaultValue={values?.phone ?? (lab?.phone ? formatPhone(lab.phone) : "")} errors={errors?.phone} />
      </div>
      <FormField label="E-mail" name="email" defaultValue={values?.email ?? lab?.email ?? ""} />
      <FormField label="Observações" name="notes" defaultValue={values?.notes ?? lab?.notes ?? ""} />
      <SwitchField name="active" label="Ativo" defaultChecked={lab?.active ?? true} />
    </>
  );
}

function ServiceFields({ labId, service, values, errors }: { labId: string; service?: Service; values?: Record<string, string>; errors: Errors }) {
  return (
    <>
      <input type="hidden" name="lab_id" value={labId} />
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <FormField label="Serviço" name="name" placeholder="Ex.: Coroa de zircônia" defaultValue={values?.name ?? service?.name ?? ""} errors={errors?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Preço (R$)" name="price" inputMode="decimal" defaultValue={values?.price ?? (service ? centsToInput(service.price_cents) : "")} errors={errors?.price} />
        <FormField label="Prazo (dias)" name="days" inputMode="numeric" defaultValue={values?.days ?? (service?.days !== null && service ? String(service.days) : "")} errors={errors?.days} />
      </div>
      <SwitchField name="active" label="Ativo" defaultChecked={service?.active ?? true} />
    </>
  );
}

export function NewLabButton() {
  return (
    <FormDialog title="Novo laboratório" action={saveLab} submitLabel="Criar" trigger={<Button><Plus aria-hidden />Novo laboratório</Button>}>
      {(state) => <LabFields values={state.values} errors={state.fieldErrors} />}
    </FormDialog>
  );
}

export function LabsSetup({ labs, services }: { labs: Lab[]; services: Service[] }) {
  if (!labs.length) return <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">Nenhum laboratório cadastrado.</p>;
  return (
    <ul className="space-y-4">
      {labs.map((lab) => (
        <li key={lab.id} className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{lab.name}</p>
              <p className="text-sm text-muted-foreground">{[lab.contact_name, lab.phone ? formatPhone(lab.phone) : null, lab.email].filter(Boolean).join(" · ")}</p>
            </div>
            {!lab.active ? <Badge variant="secondary">Inativo</Badge> : null}
            <FormDialog title="Editar laboratório" action={saveLab} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${lab.name}`}><Pencil /></Button>}>
              {(state) => <LabFields lab={lab} values={state.values} errors={state.fieldErrors} />}
            </FormDialog>
          </div>
          <ul className="divide-y rounded-lg border">
            {services.filter((s) => s.lab_id === lab.id).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">{s.name}{s.days !== null ? <span className="text-muted-foreground"> · {s.days} dias</span> : null}</span>
                {!s.active ? <Badge variant="secondary">Inativo</Badge> : null}
                <span className="tabular-nums">{formatCurrency(s.price_cents)}</span>
                <FormDialog title="Editar serviço" action={saveLabService} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${s.name}`}><Pencil /></Button>}>
                  {(state) => <ServiceFields labId={lab.id} service={s} values={state.values} errors={state.fieldErrors} />}
                </FormDialog>
              </li>
            ))}
          </ul>
          <FormDialog title={`Novo serviço · ${lab.name}`} action={saveLabService} submitLabel="Adicionar" trigger={<Button variant="outline" size="sm"><Plus aria-hidden />Adicionar serviço</Button>}>
            {(state) => <ServiceFields labId={lab.id} values={state.values} errors={state.fieldErrors} />}
          </FormDialog>
        </li>
      ))}
    </ul>
  );
}
