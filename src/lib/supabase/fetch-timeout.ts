/**
 * fetch com tempo limite para o Supabase: uma conexão que para de responder
 * (rede instável, conexão reaproveitada que caiu) vira erro em segundos em vez
 * de deixar a tela ou a rotina presa por até 15 minutos.
 */
export const SUPABASE_TIMEOUT_MS = 45_000;

export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}
