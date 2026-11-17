"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { PatientForm } from "./patient-form";

/**
 * "Novo paciente" abre o cadastro num painel lateral por cima da lista.
 * Continua sendo um link para /pacientes/novo: abrir em nova aba ou sem
 * JavaScript leva à página inteira, como antes.
 */
export function NewPatientSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Link
        href="/pacientes/novo"
        className={buttonVariants()}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        <Plus aria-hidden />
        Novo paciente
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="type-title">Novo paciente</SheetTitle>
            <SheetDescription>Depois de cadastrar, a ficha do paciente abre sozinha.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <PatientForm />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
