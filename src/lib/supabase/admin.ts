import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

import type { Database } from "./database.types";
import { fetchWithTimeout } from "./fetch-timeout";

/**
 * Cliente com a service role: IGNORA a RLS.
 * Use só em código de servidor e só quando não houver alternativa
 * (ex.: cadastro público da clínica, webhooks). Nunca exponha ao navegador.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createSupabaseClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
  });
}
