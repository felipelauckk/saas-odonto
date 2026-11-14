import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { listMembers } from "@/features/members/queries";
import { InviteMemberForm } from "@/features/members/components/invite-member-form";
import { MembersTable } from "@/features/members/components/members-table";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Equipe" };

export default async function Page() {
  const session = await requireManager();
  const members = await listMembers();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Configurações
        </Link>
        <PageHeader title="Equipe" description="Quem acessa a clínica e com qual papel." />
      </div>

      <section className="space-y-4 rounded-xl border p-5 sm:p-6" aria-labelledby="convidar">
        <div className="space-y-1">
          <h2 id="convidar" className="text-base font-medium">
            Convidar pessoa
          </h2>
          <p className="text-sm text-muted-foreground">
            A pessoa recebe um e-mail com um link para criar a senha.
          </p>
        </div>
        <InviteMemberForm canInviteOwner={session.clinic.role === "owner"} />
      </section>

      <section className="space-y-4" aria-labelledby="membros">
        <h2 id="membros" className="text-base font-medium">
          Membros
        </h2>
        {members.length ? (
          <MembersTable members={members} currentUserId={session.user.id} currentRole={session.clinic.role} />
        ) : (
          <EmptyState icon={Users} title="Ninguém na equipe ainda" description="Convide a primeira pessoa acima." />
        )}
      </section>
    </div>
  );
}
