"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Found = { error?: string; appointments?: { id: string; firstName: string; time: string }[] };

export function CheckinForm({ token, lookup, confirm }: { token: string; lookup: (token: string, phone: string) => Promise<Found>; confirm: (token: string, id: string, phone: string) => Promise<{ error?: string }> }) {
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<NonNullable<Found["appointments"]> | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border p-8 text-center">
        <CheckCircle2 className="size-10 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">Pronto, {done}!</h2>
        <p className="text-sm text-muted-foreground">Sua chegada foi registrada. Aguarde ser chamado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {found === null || found.length === 0 ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="ck-phone">Seu telefone (com DDD)</Label>
            <Input id="ck-phone" inputMode="tel" autoComplete="tel" className="h-11 text-base" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {found?.length === 0 ? <p className="text-sm text-muted-foreground">Não encontramos consulta para hoje com esse telefone. Fale com a recepção.</p> : null}
          <Button
            className="h-11 w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await lookup(token, phone);
                if (r.error) setError(r.error);
                else setFound(r.appointments ?? []);
              })
            }
          >
            Buscar minha consulta
          </Button>
        </>
      ) : (
        <ul className="space-y-2">
          {found.map((a) => (
            <li key={a.id}>
              <Button
                className="h-auto w-full justify-between py-3"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await confirm(token, a.id, phone);
                    if (r.error) setError(r.error);
                    else setDone(a.firstName);
                  })
                }
              >
                <span>Sou {a.firstName}</span>
                <span className="tabular-nums">Consulta às {a.time} · Confirmar chegada</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
