"use client";

import { Pencil, Plus, Tag } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";

import { saveTag } from "../actions/tags";
import { StatusBadge } from "./status-badge";

export type TagItem = { id: string; name: string; color: string; active: boolean };

function TagFields({ tag, state }: { tag?: TagItem; state: ActionState }) {
  const v = state.status === "error" ? state.values : undefined;
  return (
    <>
      {tag ? <input type="hidden" name="id" value={tag.id} /> : null}
      <FormField label="Nome" name="name" required maxLength={40} defaultValue={v?.name ?? tag?.name ?? ""} errors={state.fieldErrors?.name} />
      <FormField label="Cor" name="color" type="color" className="h-11 w-24 p-1" defaultValue={v?.color ?? tag?.color ?? "#64748b"} errors={state.fieldErrors?.color} />
      <SwitchField name="active" label="Ativo" description="Inativos não aparecem ao agendar." defaultChecked={v ? v.active === "on" : (tag?.active ?? true)} />
    </>
  );
}

export function NewTagButton() {
  return (
    <FormDialog title="Novo marcador" action={saveTag} submitLabel="Criar marcador" trigger={<Button><Plus aria-hidden />Novo marcador</Button>}>
      {(state) => <TagFields state={state} />}
    </FormDialog>
  );
}

export function TagsList({ tags }: { tags: TagItem[] }) {
  if (!tags.length) return <EmptyState icon={Tag} title="Nenhum marcador" description="Marcadores ajudam a identificar consultas na agenda (ex.: urgência, VIP)." />;
  return (
    <ul className="divide-y rounded-xl border">
      {tags.map((t) => (
        <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <span className="size-3 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
          <span className="flex-1 font-medium">{t.name}</span>
          {!t.active ? <StatusBadge active={false} /> : null}
          <FormDialog title="Editar marcador" action={saveTag} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${t.name}`}><Pencil /></Button>}>
            {(state) => <TagFields tag={t} state={state} />}
          </FormDialog>
        </li>
      ))}
    </ul>
  );
}
