"use client";

import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { SwitchField } from "@/components/forms/switch-field";
import type { ActionState } from "@/lib/action-state";

/** Cores bem distintas entre si, legíveis com texto branco na agenda. */
export const PROFESSIONAL_COLORS = [
  { value: "#0e7490", label: "Petróleo" },
  { value: "#2563eb", label: "Azul" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#c026d3", label: "Magenta" },
  { value: "#db2777", label: "Rosa" },
  { value: "#dc2626", label: "Vermelho" },
  { value: "#ea580c", label: "Laranja" },
  { value: "#ca8a04", label: "Mostarda" },
  { value: "#16a34a", label: "Verde" },
  { value: "#475569", label: "Grafite" },
];

export type ProfessionalData = {
  id: string;
  name: string;
  cro: string | null;
  specialty: string | null;
  color: string;
  active: boolean;
  member_id: string | null;
};

type Props = {
  professional?: ProfessionalData;
  members: { id: string; name: string }[];
  state: ActionState;
};

export function ProfessionalFields({ professional, members, state }: Props) {
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  const color = v?.color ?? professional?.color ?? PROFESSIONAL_COLORS[0]!.value;

  return (
    <>
      {professional ? <input type="hidden" name="id" value={professional.id} /> : null}
      <FormField label="Nome" name="name" required placeholder="Ex.: Dra. Ana Souza" defaultValue={v?.name ?? professional?.name ?? ""} errors={e?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="CRO" name="cro" placeholder="Ex.: SP-12345" defaultValue={v?.cro ?? professional?.cro ?? ""} errors={e?.cro} />
        <FormField
          label="Especialidade"
          name="specialty"
          placeholder="Ex.: Ortodontia"
          defaultValue={v?.specialty ?? professional?.specialty ?? ""}
          errors={e?.specialty}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Cor na agenda</legend>
        <div className="flex flex-wrap gap-2">
          {PROFESSIONAL_COLORS.map((c) => (
            <label key={c.value} className="relative cursor-pointer" title={c.label}>
              <input type="radio" name="color" value={c.value} defaultChecked={c.value === color} className="peer sr-only" />
              <span className="sr-only">{c.label}</span>
              <span
                aria-hidden
                className="block size-8 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring pointer-coarse:size-11"
                style={{ backgroundColor: c.value }}
              />
            </label>
          ))}
        </div>
        {e?.color?.[0] ? <p className="text-sm text-destructive">{e.color[0]}</p> : null}
      </fieldset>
      {members.length ? (
        <SelectField
          name="memberId"
          label="Usuário do sistema (opcional)"
          options={[{ value: "none", label: "Nenhum" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
          defaultValue={v?.memberId ?? professional?.member_id ?? "none"}
          errors={e?.memberId}
        />
      ) : null}
      <SwitchField
        name="active"
        label="Profissional ativo"
        description="Profissionais inativos não aparecem na agenda."
        defaultChecked={v ? v.active === "on" : (professional?.active ?? true)}
      />
    </>
  );
}
