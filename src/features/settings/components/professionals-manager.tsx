"use client";

import Link from "next/link";
import { ChevronRight, Plus, UserRound } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { professionalColor } from "@/lib/professional-colors";

import { saveProfessional } from "../actions/professionals";
import { ProfessionalFields, type ProfessionalData } from "./professional-fields";
import { StatusBadge } from "./status-badge";

type Member = { id: string; name: string };

export function NewProfessionalButton({ members }: { members: Member[] }) {
  return (
    <FormDialog
      title="Novo profissional"
      description="Depois de criar, você define os horários de atendimento."
      action={saveProfessional}
      submitLabel="Criar e definir horários"
      trigger={
        <Button>
          <Plus aria-hidden />
          Novo profissional
        </Button>
      }
    >
      {(state) => <ProfessionalFields members={members} state={state} />}
    </FormDialog>
  );
}

export function EditProfessionalButton({ professional, members }: { professional: ProfessionalData; members: Member[] }) {
  return (
    <FormDialog
      title="Editar profissional"
      action={saveProfessional}
      trigger={<Button variant="outline">Editar dados</Button>}
    >
      {(state) => <ProfessionalFields professional={professional} members={members} state={state} />}
    </FormDialog>
  );
}

export function ProfessionalsList({ professionals }: { professionals: ProfessionalData[] }) {
  if (!professionals.length) {
    return (
      <EmptyState
        icon={UserRound}
        title="Nenhum profissional cadastrado"
        description="Cadastre os dentistas que atendem na clínica para montar a agenda."
      />
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {professionals.map((p) => (
        <li key={p.id}>
          <Link
            href={`/configuracoes/profissionais/${p.id}`}
            className="flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 sm:px-5"
          >
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: professionalColor(p.color).value }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {!p.active ? <StatusBadge active={false} /> : null}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {[p.specialty, p.cro ? `CRO ${p.cro}` : null].filter(Boolean).join(" · ") || "Sem especialidade"}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
