"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";
import { ageFromBirthDate, todayIso } from "@/lib/dates";
import { formatCpfCnpj, formatPhone, onlyDigits } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";

import { createPatient, updatePatient } from "../actions";
import { genderLabels, patientGenders, patientSources, sourceLabels } from "../labels";
import type { Patient } from "../queries";
import { MINOR_AGE } from "../schemas";
import { useCepLookup } from "./use-cep-lookup";

type Address = {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl border p-5 sm:p-6">
      <div className="space-y-1">
        <legend className="text-base font-medium">{title}</legend>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

type PatientFormProps = {
  patient?: Patient;
  /** Editando por cima de outra tela: salva sem sair dela e avisa aqui. */
  onSaved?: () => void;
  onCancel?: () => void;
};

export function PatientForm({ patient, onSaved, onCancel }: PatientFormProps) {
  const [state, action] = useActionState(patient ? updatePatient : createPatient, idleState);
  // Avisa uma vez por resposta de sucesso (onSaved muda a cada render de quem usa).
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (state.status === "success") onSavedRef.current?.();
  }, [state]);
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  const saved = (patient?.address ?? {}) as Address;

  const [birthDate, setBirthDate] = useState(v?.birthDate ?? patient?.birth_date ?? "");
  const [sameWhatsapp, setSameWhatsapp] = useState(
    v ? v.whatsappSameAsPhone === "on" : !patient || !patient.whatsapp || patient.whatsapp === patient.phone,
  );
  const [address, setAddress] = useState<Required<Record<keyof Address, string>>>({
    cep: v?.cep ?? (saved.cep ? saved.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : ""),
    street: v?.street ?? saved.street ?? "",
    number: v?.number ?? saved.number ?? "",
    complement: v?.complement ?? saved.complement ?? "",
    district: v?.district ?? saved.district ?? "",
    city: v?.city ?? saved.city ?? "",
    state: v?.state ?? saved.state ?? "",
  });
  const cep = useCepLookup((found) => setAddress((a) => ({ ...a, ...found })));

  const isMinor = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && ageFromBirthDate(birthDate) < MINOR_AGE;
  const setField = (key: keyof Address) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [key]: ev.target.value }));

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage state={state} />
      {v?.duplicateId ? (
        <Link href={`/pacientes/${v.duplicateId}`} className={buttonVariants({ variant: "outline" })}>
          Abrir a ficha do paciente já cadastrado
        </Link>
      ) : null}
      {patient ? <input type="hidden" name="id" value={patient.id} /> : null}

      <Section title="Identificação">
        <FormField
          label="Nome completo"
          name="fullName"
          required
          autoComplete="off"
          defaultValue={v?.fullName ?? patient?.full_name ?? ""}
          errors={e?.fullName}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="CPF"
            name="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            defaultValue={v?.cpf ?? (patient?.cpf ? formatCpfCnpj(patient.cpf) : "")}
            errors={e?.cpf}
          />
          <FormField
            label="Data de nascimento"
            name="birthDate"
            type="date"
            max={todayIso()}
            value={birthDate}
            onChange={(ev) => setBirthDate(ev.target.value)}
            errors={e?.birthDate}
          />
          <SelectField
            name="gender"
            label="Gênero"
            options={[{ value: "none", label: "Não informado" }, ...patientGenders.map((g) => ({ value: g, label: genderLabels[g] }))]}
            defaultValue={v?.gender || patient?.gender || "none"}
            errors={e?.gender}
          />
        </div>
      </Section>

      {isMinor ? (
        <Section title="Responsável legal" description="Paciente menor de idade: informe quem responde por ele.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Nome do responsável"
              name="guardianName"
              required
              defaultValue={v?.guardianName ?? patient?.guardian_name ?? ""}
              errors={e?.guardianName}
            />
            <FormField
              label="CPF do responsável"
              name="guardianCpf"
              inputMode="numeric"
              defaultValue={v?.guardianCpf ?? (patient?.guardian_cpf ? formatCpfCnpj(patient.guardian_cpf) : "")}
              errors={e?.guardianCpf}
            />
          </div>
        </Section>
      ) : null}

      <Section title="Contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Telefone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 98888-7777"
            defaultValue={v?.phone ?? (patient?.phone ? formatPhone(patient.phone) : "")}
            errors={e?.phone}
          />
          <FormField
            label="E-mail"
            name="email"
            type="email"
            defaultValue={v?.email ?? patient?.email ?? ""}
            errors={e?.email}
          />
        </div>
        <Label className="flex items-center gap-3 font-normal pointer-coarse:min-h-11">
          <Checkbox
            name="whatsappSameAsPhone"
            checked={sameWhatsapp}
            onCheckedChange={(checked) => setSameWhatsapp(checked === true)}
          />
          O WhatsApp é o mesmo número do telefone
        </Label>
        {!sameWhatsapp ? (
          <FormField
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            defaultValue={v?.whatsapp ?? (patient?.whatsapp ? formatPhone(patient.whatsapp) : "")}
            errors={e?.whatsapp}
            containerClassName="sm:max-w-[calc(50%-0.5rem)]"
          />
        ) : null}
      </Section>

      <Section title="Endereço" description="Digite o CEP para preencher o restante.">
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <FormField
              label="CEP"
              name="cep"
              inputMode="numeric"
              placeholder="00000-000"
              value={address.cep}
              onChange={(ev) => {
                setAddress((a) => ({ ...a, cep: ev.target.value }));
                if (onlyDigits(ev.target.value).length === 8) cep.lookup(ev.target.value);
              }}
              errors={cep.error ? [cep.error] : e?.cep}
            />
            {cep.loading ? (
              <p role="status" className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Buscando endereço...
              </p>
            ) : null}
          </div>
          <FormField label="Rua" name="street" value={address.street} onChange={setField("street")} errors={e?.street} containerClassName="sm:col-span-4" />
          <FormField label="Número" name="number" value={address.number} onChange={setField("number")} errors={e?.number} containerClassName="sm:col-span-2" />
          <FormField label="Complemento" name="complement" value={address.complement} onChange={setField("complement")} errors={e?.complement} containerClassName="sm:col-span-4" />
          <FormField label="Bairro" name="district" value={address.district} onChange={setField("district")} errors={e?.district} containerClassName="sm:col-span-3" />
          <FormField label="Cidade" name="city" value={address.city} onChange={setField("city")} errors={e?.city} containerClassName="sm:col-span-2" />
          <FormField label="UF" name="state" maxLength={2} value={address.state} onChange={setField("state")} errors={e?.state} containerClassName="sm:col-span-1" />
        </div>
      </Section>

      <Section title="Outras informações">
        <SelectField
          name="source"
          label="Como conheceu a clínica"
          options={[{ value: "none", label: "Não informado" }, ...patientSources.map((s) => ({ value: s, label: sourceLabels[s] }))]}
          defaultValue={v?.source || patient?.source || "none"}
          errors={e?.source}
        />
        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={v?.notes ?? patient?.notes ?? ""} />
          {e?.notes?.[0] ? <p className="text-sm text-destructive">{e.notes[0]}</p> : null}
        </div>
      </Section>

      <Section title="LGPD">
        {patient?.consent_lgpd_at ? (
          <p className="text-sm">
            Consentimento registrado em <strong className="font-medium">{formatDateTime(patient.consent_lgpd_at)}</strong>.
          </p>
        ) : (
          <Label className="flex items-start gap-3 font-normal leading-normal pointer-coarse:min-h-11">
            <Checkbox name="consentLgpd" defaultChecked={v?.consentLgpd === "on"} className="mt-0.5" />
            O paciente (ou responsável) autorizou a clínica a guardar e usar seus dados pessoais e de saúde para o
            atendimento. A data e quem registrou ficam salvos.
          </Label>
        )}
      </Section>

      {onSaved ? <input type="hidden" name="stay" value="1" /> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : (
          <Link href={patient ? `/pacientes/${patient.id}` : "/pacientes"} className={buttonVariants({ variant: "outline" })}>
            Cancelar
          </Link>
        )}
        <SubmitButton pendingLabel="Salvando...">{patient ? "Salvar alterações" : "Cadastrar paciente"}</SubmitButton>
      </div>
    </form>
  );
}

