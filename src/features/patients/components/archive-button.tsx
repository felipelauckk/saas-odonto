"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";

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

import { setPatientArchived } from "../actions";

export function ArchiveButton({ patientId, archived, name }: { patientId: string; archived: boolean; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setPatientArchived(patientId, next);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        // Garante a tela atualizada mesmo se outra navegação estava em andamento.
        router.refresh();
      }
    });
  }

  if (archived) {
    return (
      <div className="space-y-1">
        <Button variant="outline" disabled={pending} onClick={() => run(false)}>
          <ArchiveRestore aria-hidden />
          Reativar paciente
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Archive aria-hidden />
        Arquivar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Arquivar {name}?</DialogTitle>
          <DialogDescription>
            O paciente sai da lista de ativos, mas nada é apagado: ficha, prontuário e financeiro continuam guardados.
            Dá para reativar a qualquer momento.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button disabled={pending} onClick={() => run(true)}>
            {pending ? "Arquivando..." : "Arquivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
