"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "cn";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";
import { ageFromBirthDate, todayIso } from "@/lib/dates";
import { formatCpfCnpj, formatPhone, onlyDigits } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";
import { ReferralField } from "@/features/crm/components/lead-fields";

import { createPatient, loadPatientFormOptions, updatePatient, type PatientFormOptions } from "../actions";
import { educationLabels, genderLabels, maritalLabels, patientGenders } from "../labels";
import type { Patient } from "../queries";
import { educationLevels, maritalStatuses, MINOR_AGE } from "../schemas";
import { isReferral, sourceOptions } from "../sources";
import { PatientPhotoField } from "./patient-photo-field";
import { useCepLookup } from "./use-cep-lookup";

type Address = { cep?: string | null; street?: string | null; number?: string | null; complement?: string | null; district?: string | null; city?: string | null; state?: string | null };

/** Blocos do cadastro completo (âncoras no topo). */
const BLOCKS = [
  { id: "pf-identificacao", label: "Identificação" },
  { id: "pf-contato", label: "Contato" },
  { id: "pf-endereco", label: "Endereço" },
  { id: "pf-responsavel", label: "Responsável e família" },
  { id: "pf-trabalho", label: "Trabalho" },
  { id: "pf-origem", label: "Como conheceu" },
  { id: "pf-observacoes", label: "Observações e LGPD" },
] as const;

/** Campos que só existem no cadastro completo: um erro neles abre o completo. */
const FULL_ONLY = new Set([
  "nickname", "rg", "maritalStatus", "education", "recordNumber", "whatsapp", "landline", "otherPhones", "instagram", "facebook", "preferredContact",
  "cep", "street", "number", "complement", "district", "city", "state", "guardianName", "guardianRelationship", "guardianCpf", "guardianRg",
  "guardianBirthDate", "guardianPhone", "fatherName", "motherName", "occupation", "workplace", "notes",
]);

const COUNTRIES = [
  { value: "55", label: "Brasil +55" },
  { value: "351", label: "Portugal +351" },
  { value: "1", label: "EUA/Canadá +1" },
  { value: "54", label: "Argentina +54" },
  { value: "595", label: "Paraguai +595" },
  { value: "598", label: "Uruguai +598" },
];

function Block({ id, title, description, hidden, children }: { id: string; title: string; description?: ReactNode; hidden?: boolean; children: ReactNode }) {
  return (
    // Atributo hidden (e não a classe): a grade da tela larga não pode reabrir o bloco escondido.
    <section id={id} aria-labelledby={`${id}-t`} hidden={hidden} className="scroll-mt-28 border-t py-6 first:border-t-0 md:grid md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:gap-8">
      <div className="mb-4 space-y-1 md:mb-0">
        <h2 id={`${id}-t`} className="type-section">
          {title}
        </h2>
        {description ? <p className="text-[0.8125rem] text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

type PatientFormProps = {
  patient?: Patient;
  /** Origens, parceiros e regras da clínica (a página já traz; o painel busca sozinho). */
  options?: PatientFormOptions | null;
  /** "quick": só o essencial, com "Preencher cadastro completo". */
  mode?: "quick" | "full";
  /** Por cima de outra tela: salva sem sair dela e avisa aqui (com o paciente criado). */
  onSaved?: (created?: { id: string; name: string; phone: string | null }) => void;
  onCancel?: () => void;
  /** Valores iniciais de um cadastro novo (ex.: o nome já digitado na busca). */
  defaults?: { fullName?: string };
};

export function PatientForm({ patient, options: initialOptions, mode = "full", onSaved, onCancel, defaults }: PatientFormProps) {
  const [state, action] = useActionState(patient ? updatePatient : createPatient, idleState);
  const [options, setOptions] = useState<PatientFormOptions | null>(initialOptions ?? null);
  const [full, setFull] = useState(mode === "full");
  const formRef = useRef<HTMLFormElement>(null);
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  const saved = (patient?.address ?? {}) as Address;

  // O painel não tem as opções prontas: busca uma vez.
  useEffect(() => {
    if (options) return;
    let alive = true;
    loadPatientFormOptions().then((o) => alive && setOptions(o));
    return () => {
      alive = false;
    };
  }, [options]);

  // Avisa uma vez por resposta de sucesso (onSaved muda a cada render de quem usa).
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (state.status !== "success") return;
    const c = state.values;
    onSavedRef.current?.(c?.createdId ? { id: c.createdId, name: c.createdName ?? "", phone: c.createdPhone || null } : undefined);
  }, [state]);

  const [birthDate, setBirthDate] = useState(v?.birthDate ?? patient?.birth_date ?? "");
  const [sameWhatsapp, setSameWhatsapp] = useState(v ? v.whatsappSameAsPhone === "on" : !patient || !patient.whatsapp || patient.whatsapp === patient.phone);
  const [noEmail, setNoEmail] = useState(v ? v.noEmail === "on" : (patient?.no_email ?? false));
  const [sourceId, setSourceId] = useState(v?.sourceId ?? patient?.source_id ?? "none");
  const [phones, setPhones] = useState<{ label: string; number: string }[]>(
    v?.otherPhones ? safeParse(v.otherPhones) : (patient?.patient_phones ?? []).map((p) => ({ label: p.label ?? "", number: formatPhone(p.number) })),
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
  const validBirth = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const age = validBirth ? ageFromBirthDate(birthDate) : null;
  const isMinor = age !== null && age < MINOR_AGE;
  const [preferred, setPreferred] = useState<"patient" | "guardian">((v?.preferredContact as "patient" | "guardian") ?? (patient?.preferred_contact as "patient" | "guardian") ?? "patient");
  // Menor: falar com o responsável por padrão (enquanto ninguém escolheu outra coisa).
  const [preferredTouched, setPreferredTouched] = useState(Boolean(patient));
  const preferredContact = !preferredTouched && isMinor ? "guardian" : preferred;
  const [guardianOpen, setGuardianOpen] = useState(Boolean(patient?.guardian_name || patient?.father_name || patient?.mother_name));
  const guardianShown = isMinor || guardianOpen;

  // Erro do servidor: abre o completo e o bloco certo e rola até o primeiro campo com problema.
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const keys = Object.keys(state.fieldErrors);
    const t = setTimeout(() => {
      if (keys.some((k) => FULL_ONLY.has(k))) setFull(true);
      if (keys.some((k) => k.startsWith("guardian"))) setGuardianOpen(true);
      requestAnimationFrame(() => {
        const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        el?.focus({ preventScroll: true });
      });
    }, 0);
    return () => clearTimeout(t);
  }, [state]);

  const sources = options?.sources ?? [];
  const selectedSource = sources.find((s) => s.id === sourceId) ?? null;
  const referralInitial = v?.referral ?? (patient?.referred_by_patient_id ? `patient:${patient.referred_by_patient_id}` : patient?.referred_by_partner_id ? `partner:${patient.referred_by_partner_id}` : "");
  const referralName = patient?.referrer_name ?? patient?.referral_partners?.name ?? null;
  const showReferral = isReferral(selectedSource) || Boolean(referralInitial);
  const setField = (key: keyof Address) => (ev: React.ChangeEvent<HTMLInputElement>) => setAddress((a) => ({ ...a, [key]: ev.target.value }));
  const hideIfQuick = full ? "" : "hidden";

  return (
    <form ref={formRef} action={action} className="space-y-2" noValidate>
      <FormMessage state={state} />
      {v?.duplicateId ? (
        <Link href={`/pacientes/${v.duplicateId}`} className={buttonVariants({ variant: "outline" })}>
          Abrir a ficha do paciente já cadastrado
        </Link>
      ) : null}
      {patient ? <input type="hidden" name="id" value={patient.id} /> : null}
      {onSaved ? <input type="hidden" name="stay" value="1" /> : null}
      <input type="hidden" name="otherPhones" value={JSON.stringify(phones.filter((p) => onlyDigits(p.number)).map((p) => ({ label: p.label, number: onlyDigits(p.number) })))} />
      <input type="hidden" name="preferredContact" value={preferredContact} />
      <input type="hidden" name="sourceId" value={sourceId} />

      {full ? (
        <nav aria-label="Blocos do cadastro" className="sticky top-0 z-10 -mx-1 flex gap-1.5 overflow-x-auto bg-card/95 px-1 py-2 backdrop-blur">
          {BLOCKS.map((b) => (
            <a
              key={b.id}
              href={`#${b.id}`}
              onClick={(ev) => {
                ev.preventDefault();
                if (b.id === "pf-responsavel") setGuardianOpen(true);
                document.getElementById(b.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex h-8 shrink-0 items-center rounded-full border bg-card px-3 text-[0.8125rem] font-medium whitespace-nowrap hover:bg-muted pointer-coarse:h-11"
            >
              {b.label}
            </a>
          ))}
        </nav>
      ) : null}

      <div className="rounded-card border bg-card px-5 shadow-card sm:px-6">
        <Block id="pf-identificacao" title="Identificação" description={full ? "Quem é o paciente." : undefined}>
          {full && patient && options ? <PatientPhotoField patientId={patient.id} clinicId={options.clinicId} initialPath={patient.photo_path} name={patient.full_name} /> : null}
          {full && !patient ? <p className="text-[0.8125rem] text-muted-foreground">A foto pode ser incluída depois de salvar o cadastro.</p> : null}
          <FormField label="Nome completo" name="fullName" required autoComplete="off" defaultValue={v?.fullName ?? patient?.full_name ?? defaults?.fullName ?? ""} errors={e?.fullName} />
          <div className={cn("grid gap-4 sm:grid-cols-2", hideIfQuick)}>
            <FormField label="Como prefere ser chamado" name="nickname" defaultValue={v?.nickname ?? patient?.nickname ?? ""} errors={e?.nickname} />
            <FormField
              label="Nº de prontuário"
              name="recordNumber"
              placeholder={options?.recordAuto && !patient ? "Automático" : ""}
              hint={options?.recordAuto && !patient ? "Deixe em branco para numerar sozinho." : undefined}
              defaultValue={v?.recordNumber ?? patient?.record_number ?? ""}
              errors={e?.recordNumber}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FormField label="Data de nascimento" name="birthDate" type="date" max={todayIso()} value={birthDate} onChange={(ev) => setBirthDate(ev.target.value)} errors={e?.birthDate} />
              {age !== null ? (
                <p className="text-[0.8125rem] text-muted-foreground" aria-live="polite">
                  {age} {age === 1 ? "ano" : "anos"}
                  {isMinor ? " · menor de idade" : ""}
                </p>
              ) : null}
            </div>
            <SelectField
              name="gender"
              label="Gênero"
              options={[{ value: "none", label: "Não informado" }, ...patientGenders.map((g) => ({ value: g, label: genderLabels[g] }))]}
              defaultValue={v?.gender || patient?.gender || "none"}
              errors={e?.gender}
            />
            <FormField label="CPF" name="cpf" inputMode="numeric" placeholder="000.000.000-00" defaultValue={v?.cpf ?? (patient?.cpf ? formatCpfCnpj(patient.cpf) : "")} errors={e?.cpf} />
          </div>
          <div className={cn("grid gap-4 sm:grid-cols-3", hideIfQuick)}>
            <FormField label="RG" name="rg" defaultValue={v?.rg ?? patient?.rg ?? ""} errors={e?.rg} />
            <SelectField
              name="maritalStatus"
              label="Estado civil"
              options={[{ value: "none", label: "Não informado" }, ...maritalStatuses.map((m) => ({ value: m, label: maritalLabels[m] }))]}
              defaultValue={v?.maritalStatus || patient?.marital_status || "none"}
            />
            <SelectField
              name="education"
              label="Escolaridade"
              options={[{ value: "none", label: "Não informada" }, ...educationLevels.map((m) => ({ value: m, label: educationLabels[m] }))]}
              defaultValue={v?.education || patient?.education || "none"}
            />
          </div>
        </Block>

        <Block id="pf-contato" title="Contato" description={full ? "Por onde a clínica fala com o paciente." : undefined}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="phoneCountry">País</Label>
              <select
                id="phoneCountry"
                name="phoneCountry"
                defaultValue={v?.phoneCountry ?? patient?.phone_country ?? "55"}
                className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm pointer-coarse:h-11"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <FormField label="Celular" name="phone" type="tel" inputMode="tel" placeholder="(11) 98888-7777" defaultValue={v?.phone ?? (patient?.phone ? formatPhone(patient.phone) : "")} errors={e?.phone} />
          </div>
          <div className={cn("space-y-4", hideIfQuick)}>
            <Label className="flex items-center gap-3 font-normal pointer-coarse:min-h-11">
              <Checkbox name="whatsappSameAsPhone" checked={sameWhatsapp} onCheckedChange={(c) => setSameWhatsapp(c === true)} />
              O WhatsApp é o mesmo número do celular
            </Label>
            {!sameWhatsapp ? (
              <FormField label="WhatsApp" name="whatsapp" type="tel" inputMode="tel" defaultValue={v?.whatsapp ?? (patient?.whatsapp ? formatPhone(patient.whatsapp) : "")} errors={e?.whatsapp} containerClassName="sm:max-w-[calc(50%-0.5rem)]" />
            ) : null}
            <FormField label="Telefone fixo" name="landline" type="tel" inputMode="tel" placeholder="(11) 3333-4444" defaultValue={v?.landline ?? (patient?.landline ? formatPhone(patient.landline) : "")} errors={e?.landline} containerClassName="sm:max-w-[calc(50%-0.5rem)]" />
            <div className="space-y-2">
              <span className="text-sm font-medium" id="other-phones">
                Outros telefones
              </span>
              {phones.length ? (
                <ul className="space-y-2" aria-labelledby="other-phones">
                  {phones.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <Input aria-label={`Nome do telefone ${i + 1}`} placeholder="Ex.: trabalho, mãe" value={p.label} maxLength={40} onChange={(ev) => setPhones((list) => list.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} className="w-36 shrink-0 sm:w-44" />
                      <Input aria-label={`Número do telefone ${i + 1}`} type="tel" inputMode="tel" placeholder="(11) 98888-7777" value={p.number} onChange={(ev) => setPhones((list) => list.map((x, j) => (j === i ? { ...x, number: ev.target.value } : x)))} className="min-w-0 flex-1" />
                      <Button type="button" variant="ghost" size="icon" aria-label={`Tirar telefone ${i + 1}`} onClick={() => setPhones((list) => list.filter((_, j) => j !== i))}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {e?.otherPhones?.[0] ? <p className="text-sm text-destructive">{e.otherPhones[0]}</p> : null}
              {phones.length < 10 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setPhones((list) => [...list, { label: "", number: "" }])}>
                  <Plus aria-hidden />
                  Adicionar telefone
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            {noEmail ? null : (
              <FormField
                label={options?.requireEmail ? "E-mail" : "E-mail (opcional)"}
                name="email"
                type="email"
                required={options?.requireEmail}
                defaultValue={v?.email ?? patient?.email ?? ""}
                errors={e?.email}
              />
            )}
            <Label className="flex items-center gap-3 font-normal pointer-coarse:min-h-11">
              <Checkbox name="noEmail" checked={noEmail} onCheckedChange={(c) => setNoEmail(c === true)} />
              Não tem e-mail
            </Label>
          </div>
          <div className={cn("grid gap-4 sm:grid-cols-2", hideIfQuick)}>
            <FormField label="Instagram" name="instagram" placeholder="usuario" hint="Só o usuário, sem @." defaultValue={v?.instagram ?? patient?.instagram ?? ""} errors={e?.instagram} />
            <FormField label="Facebook" name="facebook" placeholder="usuario" defaultValue={v?.facebook ?? patient?.facebook ?? ""} errors={e?.facebook} />
          </div>
          <div className={cn("space-y-2", hideIfQuick)}>
            <span className="text-sm font-medium" id="preferred-label">
              Entrar em contato pelo celular de
            </span>
            <div role="radiogroup" aria-labelledby="preferred-label" className="flex flex-wrap gap-2">
              {(["patient", "guardian"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={preferredContact === k}
                  onClick={() => {
                    setPreferred(k);
                    setPreferredTouched(true);
                    if (k === "guardian") setGuardianOpen(true);
                  }}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-3.5 text-[0.8125rem] font-medium pointer-coarse:h-11",
                    preferredContact === k ? "border-foreground bg-foreground font-semibold text-background" : "border-input bg-card hover:bg-muted",
                  )}
                >
                  {k === "patient" ? "Paciente" : "Responsável"}
                </button>
              ))}
            </div>
          </div>
        </Block>

        <Block id="pf-endereco" title="Endereço" description="Digite o CEP para preencher o restante." hidden={!full}>
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
        </Block>

        <Block
          id="pf-responsavel"
          title="Responsável e família"
          description={isMinor ? "Paciente menor de idade: nome, CPF e telefone do responsável são obrigatórios." : "Opcional para adultos."}
          hidden={!full && !isMinor}
        >
          {guardianShown ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nome do responsável" name="guardianName" required={isMinor} defaultValue={v?.guardianName ?? patient?.guardian_name ?? ""} errors={e?.guardianName} />
                <FormField label="Parentesco" name="guardianRelationship" placeholder="Ex.: mãe, pai, avó" defaultValue={v?.guardianRelationship ?? patient?.guardian_relationship ?? ""} errors={e?.guardianRelationship} />
                <FormField label="CPF do responsável" name="guardianCpf" inputMode="numeric" required={isMinor} defaultValue={v?.guardianCpf ?? (patient?.guardian_cpf ? formatCpfCnpj(patient.guardian_cpf) : "")} errors={e?.guardianCpf} />
                <FormField label="RG do responsável" name="guardianRg" defaultValue={v?.guardianRg ?? patient?.guardian_rg ?? ""} errors={e?.guardianRg} />
                <FormField label="Nascimento do responsável" name="guardianBirthDate" type="date" max={todayIso()} defaultValue={v?.guardianBirthDate ?? patient?.guardian_birth_date ?? ""} errors={e?.guardianBirthDate} />
                <FormField label="Telefone do responsável" name="guardianPhone" type="tel" inputMode="tel" required={isMinor} defaultValue={v?.guardianPhone ?? (patient?.guardian_phone ? formatPhone(patient.guardian_phone) : "")} errors={e?.guardianPhone} />
              </div>
              <div className={cn("grid gap-4 sm:grid-cols-2", hideIfQuick)}>
                <FormField label="Nome do pai" name="fatherName" defaultValue={v?.fatherName ?? patient?.father_name ?? ""} errors={e?.fatherName} />
                <FormField label="Nome da mãe" name="motherName" defaultValue={v?.motherName ?? patient?.mother_name ?? ""} errors={e?.motherName} />
              </div>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setGuardianOpen(true)}>
              <Plus aria-hidden />
              Incluir responsável e família
            </Button>
          )}
        </Block>

        <Block id="pf-trabalho" title="Trabalho" hidden={!full}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Profissão" name="occupation" defaultValue={v?.occupation ?? patient?.occupation ?? ""} errors={e?.occupation} />
            <FormField label="Local de trabalho" name="workplace" defaultValue={v?.workplace ?? patient?.workplace ?? ""} errors={e?.workplace} />
          </div>
        </Block>

        <Block id="pf-origem" title="Como conheceu" description={full ? "Aparece no CRM e nos relatórios de captação." : undefined}>
          <div className="space-y-1.5">
            <Label htmlFor="pf-source">Como conheceu a clínica</Label>
            <select
              id="pf-source"
              value={sourceId}
              onChange={(ev) => setSourceId(ev.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm pointer-coarse:h-11 sm:max-w-sm"
            >
              <option value="none">Não informado</option>
              {sourceOptions(sources, patient?.source_id).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {showReferral && options ? <ReferralField initial={referralInitial} initialName={referralName} partners={options.partners} /> : <input type="hidden" name="referral" value={referralInitial} />}
          {e?.referral?.[0] ? <p className="text-sm text-destructive">{e.referral[0]}</p> : null}
        </Block>

        <Block id="pf-observacoes" title="Observações e LGPD" hidden={!full}>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={v?.notes ?? patient?.notes ?? ""} />
            {e?.notes?.[0] ? <p className="text-sm text-destructive">{e.notes[0]}</p> : null}
          </div>
          {patient?.consent_lgpd_at ? (
            <p className="text-sm">
              Consentimento registrado em <strong className="font-medium">{formatDateTime(patient.consent_lgpd_at)}</strong>.
            </p>
          ) : (
            <Label className="flex items-start gap-3 leading-normal font-normal pointer-coarse:min-h-11">
              <Checkbox name="consentLgpd" defaultChecked={v?.consentLgpd === "on"} className="mt-0.5" />
              O paciente (ou responsável) autorizou a clínica a guardar e usar seus dados pessoais e de saúde para o atendimento. A data e quem registrou ficam salvos.
            </Label>
          )}
        </Block>
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-b-card">
        {!full ? (
          <Button type="button" variant="ghost" onClick={() => setFull(true)} className="sm:mr-auto">
            Preencher cadastro completo
          </Button>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : (
          <Link href={patient ? `/pacientes/${patient.id}/dados` : "/pacientes"} className={buttonVariants({ variant: "outline" })}>
            Cancelar
          </Link>
        )}
        <SubmitButton pendingLabel="Salvando...">{patient ? "Salvar" : "Cadastrar paciente"}</SubmitButton>
      </div>
    </form>
  );
}

function safeParse(value: string): { label: string; number: string }[] {
  try {
    const list = JSON.parse(value) as { label?: string; number?: string }[];
    return Array.isArray(list) ? list.map((p) => ({ label: p.label ?? "", number: p.number ? formatPhone(p.number) : "" })) : [];
  } catch {
    return [];
  }
}
