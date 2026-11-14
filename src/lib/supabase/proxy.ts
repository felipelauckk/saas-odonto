import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv, hasPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

/** Telas abertas sem login. */
const PUBLIC_PATHS = ["/entrar", "/cadastro", "/recuperar-senha", "/auth"];
/** Telas que quem já está logado não precisa ver. */
const GUEST_ONLY_PATHS = ["/entrar", "/cadastro"];

function matches(pathname: string, paths: readonly string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Renova a sessão do Supabase a cada requisição e protege as rotas:
 * sem login → /entrar; logado em /entrar ou /cadastro → /painel.
 * A RLS continua sendo a proteção real dos dados; isto é só navegação.
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
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isLoggedIn && !matches(pathname, PUBLIC_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    if (pathname !== "/" && pathname !== "/painel") {
      url.searchParams.set("next", `${pathname}${search}`);
    }
    return redirectWithCookies(url, response);
  }

  if (isLoggedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/** Redireciona sem perder os cookies de sessão que acabaram de ser renovados. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
