"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { updateMemberUnits } from "../actions";

type Props = {
  member: { id: string; name: string; unitIds: string[] } | null;
  units: { id: string; name: string }[];
  onClose: () => void;
};

/** Escolhe as unidades que um dentista ou recepcionista pode ver. */
export function MemberUnitsDialog({ member, units, onClose }: Props) {
  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {member ? <MemberUnitsForm key={member.id} member={member} units={units} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MemberUnitsForm({ member, units, onClose }: Props & { member: NonNullable<Props["member"]> }) {
  const [all, setAll] = useState(member.unitIds.length === 0);
  const [selected, setSelected] = useState<string[]>(member.unitIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!all && selected.length === 0) {
      setError("Escolha pelo menos uma unidade.");
      return;
    }
    startTransition(async () => {
      const result = await updateMemberUnits({ memberId: member.id, unitIds: all ? [] : selected });
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Unidades de {member.name}</DialogTitle>
        <DialogDescription>A pessoa só vê a agenda e o caixa das unidades marcadas.</DialogDescription>
      </DialogHeader>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <div className="space-y-2">
        <Label className="flex items-center gap-3 rounded-lg border px-3 py-2.5 font-normal pointer-coarse:min-h-11">
          <Checkbox checked={all} onCheckedChange={(checked) => setAll(checked === true)} />
          Todas as unidades
        </Label>
        {!all
          ? units.map((unit) => (
              <Label
                key={unit.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 font-normal pointer-coarse:min-h-11"
              >
                <Checkbox
                  checked={selected.includes(unit.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked === true ? [...current, unit.id] : current.filter((id) => id !== unit.id),
                    )
                  }
                />
                {unit.name}
              </Label>
            ))
          : null}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}
