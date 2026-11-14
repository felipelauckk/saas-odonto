"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { buttonVariants } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

const otpTypes: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (otpTypes as readonly string[]).includes(value);
}

/**
 * Conclui os links enviados por e-mail (confirmação, convite, nova senha).
 * Aceita os três formatos do Supabase: ?token_hash=&type=, ?code= (PKCE)
 * e #access_token= (convites com o modelo de e-mail padrão).
 */
export function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function run() {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const tokenHash = params.get("token_hash");
      const type = params.get("type") ?? hash.get("type");
      const code = params.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      // Convite e recuperação sempre levam à tela de nova senha.
      const next =
        type === "invite" || type === "recovery"
          ? "/nova-senha"
          : safeRedirectPath(params.get("next"));

      let ok = false;
      if (params.get("error") || hash.get("error")) {
        ok = false;
      } else if (tokenHash && isOtpType(type)) {
        ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
      } else if (code) {
        ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
      } else if (accessToken && refreshToken) {
        ok = !(await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })).error;
      }

      if (ok) {
        router.replace(next);
        router.refresh();
      } else {
        setFailed(true);
      }
    }

    void run();
  }, [params, router]);

  if (failed) {
    return (
      <div className="space-y-4">
        <FormMessage
          state={{
            status: "error",
            message:
              "Este link expirou ou já foi usado. Se você já confirmou o e-mail, entre com sua senha. Também é possível pedir um novo link.",
          }}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/entrar" className={buttonVariants({ className: "flex-1" })}>
            Ir para o login
          </Link>
          <Link href="/recuperar-senha" className={buttonVariants({ variant: "outline", className: "flex-1" })}>
            Pedir novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Confirmando seu acesso...
    </div>
  );
}
