import type { Metadata } from "next";
import Link from "next/link";

import { AuthHeader } from "@/components/layout/auth-header";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Cadastro" };

export default function Page() {
  return (
    <>
      <AuthHeader
        title="Cadastre sua clínica"
        description="14 dias grátis, sem cartão de crédito."
      />
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-primary underline-offset-4 hover:text-primary-hover hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
