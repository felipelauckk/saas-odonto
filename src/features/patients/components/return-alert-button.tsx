"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ReturnAlertForm } from "@/features/agenda/components/return-alert-form";

/** "+ Definir retorno" na ficha: o mesmo alerta da agenda, com o paciente já escolhido. */
export function ReturnAlertButton({ patient, professionals }: { patient: { id: string; name: string }; professionals: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BellPlus aria-hidden />
        Definir retorno
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {open ? (
            <ReturnAlertForm
              professionals={professionals}
              initialPatient={{ id: patient.id, name: patient.name, detail: null }}
              onCancel={() => setOpen(false)}
              onDone={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
