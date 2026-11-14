import { Building2 } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

/** Usuário logado sem vínculo ativo com nenhuma clínica. */
export function NoClinicAccess({ email }: { email: string }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Brand />
      </div>
      <div className="w-full max-w-md">
        <EmptyState
          icon={Building2}
          title="Você não tem acesso a nenhuma clínica"
          description={`A conta ${email} não está ligada a nenhuma clínica ativa. Peça um convite ao responsável pela clínica.`}
          action={
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Sair
              </Button>
            </form>
          }
        />
      </div>
    </div>
  );
}
