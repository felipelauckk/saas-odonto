import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import { AuthHeader } from "@/components/layout/auth-header";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Entrar" };

export default async function Page({ searchParams }: PageProps<"/entrar">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeRedirectPath(next) : undefined;

  return (
    <>
      <AuthHeader title="Bem-vindo de volta" description="Entre com o e-mail cadastrado na sua clínica." />
      <SignInForm next={nextPath} />
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <Link href="/cadastro" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full text-[0.9375rem]")}>
        Criar conta da clínica · 14 dias grátis
      </Link>
    </>
  );
}
