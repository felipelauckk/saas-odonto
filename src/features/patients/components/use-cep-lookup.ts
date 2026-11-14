"use client";

import { useRef, useState } from "react";

import { onlyDigits } from "@/lib/documents";

type FoundAddress = { street: string; district: string; city: string; state: string };

type ViaCepResponse = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
};

/**
 * Busca o endereço de um CEP no ViaCEP (serviço público e gratuito).
 * Só o CEP sai do navegador; nenhum dado do paciente é enviado.
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
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await response.json()) as ViaCepResponse;
      if (!response.ok || data.erro) {
        setError("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      onFound({
        street: data.logradouro ?? "",
        district: data.bairro ?? "",
        city: data.localidade ?? "",
        state: data.uf ?? "",
      });
    } catch {
      setError("Não foi possível buscar o CEP. Preencha o endereço manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return { lookup, loading, error };
}
