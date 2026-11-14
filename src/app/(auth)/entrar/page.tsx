import type { Metadata } from "next";
import Link from "next/link";

import { AuthHeader } from "@/components/layout/auth-header";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Entrar" };

export default async function Page({ searchParams }: PageProps<"/entrar">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeRedirectPath(next) : undefined;

  return (
    <>
      <AuthHeader title="Entrar" description="Acesse a gestão da sua clínica." />
      <SignInForm next={nextPath} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">
          Cadastre sua clínica
        </Link>
      </p>
    </>
  );
}
