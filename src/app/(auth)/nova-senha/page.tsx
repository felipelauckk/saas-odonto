import type { Metadata } from "next";

import { AuthHeader } from "@/components/layout/auth-header";
import { NewPasswordForm } from "@/features/auth/components/new-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <>
      <AuthHeader title="Crie sua senha" description="Você usará esta senha para entrar no sistema." />
      <NewPasswordForm />
    </>
  );
}
