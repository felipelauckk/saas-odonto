import type { Metadata } from "next";
import Link from "next/link";

import { AuthHeader } from "@/components/layout/auth-header";
import { RecoverPasswordForm } from "@/features/auth/components/recover-password-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function Page() {
  return (
    <>
      <AuthHeader
        title="Recuperar senha"
        description="Informe seu e-mail e enviaremos um link para criar uma nova senha."
      />
      <RecoverPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/entrar" className="font-medium text-foreground underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
