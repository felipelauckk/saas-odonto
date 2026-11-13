import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv, hasPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Renova a sessão do Supabase a cada requisição e devolve os cookies atualizados.
 * A proteção de rotas (redirecionar para o login) entra na Etapa 2.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Sem .env.local configurado o app ainda abre (layout e páginas vazias).
  if (!hasPublicEnv()) return response;

  const env = getPublicEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Não coloque código entre a criação do cliente e esta chamada.
  await supabase.auth.getClaims();

  return response;
}
