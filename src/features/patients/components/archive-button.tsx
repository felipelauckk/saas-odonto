"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { setPatientArchived } from "../actions";

type Props = { patientId: string; archived: boolean; name: string; open: boolean; onOpenChange: (open: boolean) => void };

/** Inativar (arquivar) ou reativar o paciente. Nada é apagado. */
export function ArchiveDialog({ patientId, archived, name, open, onOpenChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await setPatientArchived(patientId, !archived);
      if (result.error) setError(result.error);
      else {
        onOpenChange(false);
        // Garante a tela atualizada mesmo se outra navegação estava em andamento.
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{archived ? `Reativar ${name}?` : `Inativar ${name}?`}</DialogTitle>
          <DialogDescription>
            {archived
              ? "O paciente volta para a lista de ativos e pode ser agendado de novo."
              : "O paciente sai da lista de ativos, mas nada é apagado: ficha, prontuário e financeiro continuam guardados. Dá para reativar a qualquer momento."}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button disabled={pending} onClick={run}>
            {archived ? (pending ? "Reativando..." : "Reativar") : pending ? "Inativando..." : "Inativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
