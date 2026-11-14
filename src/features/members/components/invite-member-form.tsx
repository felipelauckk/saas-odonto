"use client";

import { useActionState, useEffect, useRef } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { idleState } from "@/lib/action-state";
import { roleLabels, type MemberRole } from "@/features/tenancy/roles";

import { inviteMember } from "../actions";

const roleHints: Record<MemberRole, string> = {
  owner: "Acesso total, inclusive assinatura.",
  manager: "Acesso total à clínica.",
  dentist: "Agenda própria, pacientes e prontuário.",
  receptionist: "Agenda, pacientes, orçamentos e recebimentos.",
};

export function InviteMemberForm({ canInviteOwner }: { canInviteOwner: boolean }) {
  const [state, action] = useActionState(inviteMember, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  const roles = (Object.keys(roleLabels) as MemberRole[]).filter((r) => canInviteOwner || r !== "owner");
  const items = roles.map((r) => ({ value: r, label: roleLabels[r] }));
  const roleError = state.fieldErrors?.role?.[0];

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Nome"
          name="fullName"
          autoComplete="off"
          required
          defaultValue={state.status === "error" ? state.values?.fullName : undefined}
          errors={state.fieldErrors?.fullName}
        />
        <FormField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="off"
          required
          defaultValue={state.status === "error" ? state.values?.email : undefined}
          errors={state.fieldErrors?.email}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Papel</Label>
        <Select
          name="role"
          items={items}
          defaultValue={(state.status === "error" ? state.values?.role : undefined) ?? "receptionist"}
        >
          <SelectTrigger
            id="role"
            aria-invalid={roleError ? true : undefined}
            className="w-full data-[size=default]:h-9 pointer-coarse:data-[size=default]:h-11 sm:w-72"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role} value={role} className="pointer-coarse:min-h-11">
                <span className="flex flex-col">
                  <span>{roleLabels[role]}</span>
                  <span className="text-xs text-muted-foreground">{roleHints[role]}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {roleError ? <p className="text-sm text-destructive">{roleError}</p> : null}
      </div>
      <SubmitButton pendingLabel="Enviando convite...">Enviar convite</SubmitButton>
    </form>
  );
}
