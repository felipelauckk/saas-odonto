"use client";

import { useActionState, useEffect, useState, type ReactElement, type ReactNode } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { idleState, type ActionState } from "@/lib/action-state";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type FormDialogProps = {
  title: string;
  description?: string;
  /** Botão que abre a janela (vai no `render` do gatilho). */
  trigger: ReactElement;
  action: FormAction;
  submitLabel?: string;
  /** Campos do formulário; recebem o estado para mostrar erros e valores. */
  children: (state: ActionState) => ReactNode;
};

/** Janela com formulário ligado a uma Server Action. Fecha sozinha ao salvar. */
export function FormDialog({ title, description, trigger, action, submitLabel = "Salvar", children }: FormDialogProps) {
  const [open, setOpen] = useState(false);
  // Cada abertura monta o formulário de novo (estado limpo).
  const [session, setSession] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSession((s) => s + 1);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogForm key={session} action={action} submitLabel={submitLabel} onSuccess={() => setOpen(false)}>
          {children}
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

function DialogForm({
  action,
  submitLabel,
  onSuccess,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  onSuccess: () => void;
  children: (state: ActionState) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, idleState);

  useEffect(() => {
    if (state.status === "success") onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {children(state)}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <SubmitButton pendingLabel="Salvando...">{submitLabel}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
