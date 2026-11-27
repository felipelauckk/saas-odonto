"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/documents";

import { findPatients, quickCreatePatient, type PatientOption } from "../actions";

type PatientPickerProps = {
  value: PatientOption | null;
  onChange: (patient: PatientOption | null) => void;
  error?: string;
  /** Esconde o telefone no cartão (quem usa já mostra o contato logo abaixo). */
  hideDetail?: boolean;
  /** Cadastro rápido completo (painel "Novo paciente"); sem isso, cadastra só nome e telefone aqui. */
  onCreateNew?: (name: string) => void;
};

/** Escolhe o paciente pelo nome, CPF ou telefone; cadastra um novo se não achar. */
export function PatientPicker({ value, onChange, error, hideDetail = false, onCreateNew }: PatientPickerProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [found, setResults] = useState<PatientOption[]>([]);
  const [searched, setSearched] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSearch = !value && query.trim().length >= 2;

  useEffect(() => {
    if (!canSearch) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        setResults(await findPatients(query));
        setSearched(query);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, canSearch]);

  // Resultados valem só para o texto que foi buscado.
  const results = canSearch ? found : [];
  const searchedNow = canSearch && searched === query;

  if (value) {
    return (
      <div className="space-y-1.5">
        <Label>Paciente</Label>
        <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 pointer-coarse:min-h-11">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{value.name}</p>
            {value.detail && !hideDetail ? <p className="text-xs text-muted-foreground">{formatPhone(value.detail)}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Trocar paciente" onClick={() => onChange(null)}>
            <X />
          </Button>
        </div>
      </div>
    );
  }

  function create() {
    setCreateError(null);
    startTransition(async () => {
      const result = await quickCreatePatient({ fullName: query, phone: newPhone });
      if (result.error || !result.option) {
        setCreateError(result.error ?? "Não foi possível cadastrar.");
        return;
      }
      setCreating(false);
      setQuery("");
      onChange(result.option);
    });
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Paciente</Label>
      <div className="relative">
        {pending ? (
          <Loader2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        )}
        <Input
          id={id}
          value={query}
          autoComplete="off"
          placeholder="Nome, CPF ou telefone"
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setCreating(false);
          }}
          className="pl-8"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {results.length ? (
        <ul className="max-h-56 overflow-y-auto rounded-lg border" aria-label="Pacientes encontrados">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange(p)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none pointer-coarse:min-h-11"
              >
                <span className="truncate font-medium">{p.name}</span>
                {p.detail ? <span className="shrink-0 text-xs text-muted-foreground">{formatPhone(p.detail)}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {searchedNow && !pending && query.trim().length >= 3 ? (
        creating ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm">
              Cadastrar <strong className="font-medium">{query.trim()}</strong>
            </p>
            <Input
              type="tel"
              inputMode="tel"
              aria-label="Telefone do novo paciente"
              placeholder="Telefone com DDD (opcional)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={create} disabled={pending}>
                Cadastrar e selecionar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => (onCreateNew ? onCreateNew(query.trim()) : setCreating(true))}>
            <UserPlus aria-hidden />
            {results.length ? "Não é nenhum destes: cadastrar novo" : `Cadastrar "${query.trim()}"`}
          </Button>
        )
      ) : null}
    </div>
  );
}
