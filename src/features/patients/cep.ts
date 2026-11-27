"use server";

import { z } from "zod";

export type FoundAddress = { street: string; district: string; city: string; state: string };

type ViaCepResponse = { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean | string };

/** Endereço de um CEP pelo ViaCEP, consultado no servidor (só o CEP sai daqui). */
export async function lookupCep(value: string): Promise<{ address?: FoundAddress; error?: string }> {
  const cep = value.replace(/\D/g, "");
  if (!z.string().regex(/^\d{8}$/).safeParse(cep).success) return { error: "CEP inválido." };
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(5000), cache: "force-cache" });
    const data = (await response.json()) as ViaCepResponse;
    if (!response.ok || data.erro) return { error: "CEP não encontrado. Preencha o endereço manualmente." };
    return { address: { street: data.logradouro ?? "", district: data.bairro ?? "", city: data.localidade ?? "", state: data.uf ?? "" } };
  } catch {
    return { error: "Não foi possível buscar o CEP. Preencha o endereço manualmente." };
  }
}
