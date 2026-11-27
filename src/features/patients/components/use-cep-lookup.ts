"use client";

import { useRef, useState } from "react";

import { onlyDigits } from "@/lib/documents";

import { lookupCep, type FoundAddress } from "../cep";

/**
 * Busca o endereço de um CEP no ViaCEP (serviço público e gratuito), pelo
 * servidor. Só o CEP é enviado; nenhum dado do paciente sai.
 */
export function useCepLookup(onFound: (address: FoundAddress) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCep = useRef<string | null>(null);

  async function lookup(value: string) {
    const cep = onlyDigits(value);
    if (cep.length !== 8 || cep === lastCep.current) return;
    lastCep.current = cep;
    setLoading(true);
    setError(null);
    try {
      const result = await lookupCep(cep);
      if (result.error || !result.address) {
        setError(result.error ?? "CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      onFound(result.address);
    } catch {
      setError("Não foi possível buscar o CEP. Preencha o endereço manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return { lookup, loading, error };
}
