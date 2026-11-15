import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";
import { fetchWithTimeout } from "./fetch-timeout";

/**
 * Cliente do Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a sessão do usuário (cookies), portanto respeita a RLS.
 * Crie um novo cliente a cada requisição.
 */
export async function createClient() {
  // cookies() antes de tudo: marca a rota como dinâmica (nunca gerada no build).
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Chamado a partir de um Server Component, onde não é possível gravar
            // cookies. O proxy já renova a sessão, então pode ser ignorado.
          }
        },
      },
    },
  );
}
