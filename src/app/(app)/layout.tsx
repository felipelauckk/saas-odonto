import { redirect } from "next/navigation";

import { CommandMenu } from "@/components/layout/command-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SubscriptionBanner } from "@/features/billing/components/subscription-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { NoClinicAccess } from "@/features/tenancy/components/no-clinic-access";
import { UserMenu } from "@/features/auth/components/user-menu";
import { WorkspaceSwitcher } from "@/features/tenancy/components/workspace-switcher";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic, roleLabels } from "@/features/tenancy/roles";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSessionContext();
  if (!session) redirect("/entrar");

  const { user, clinic, clinics, units, activeUnit } = session;
  if (!clinic) return <NoClinicAccess email={user.email} />;

  const canManage = canManageClinic(clinic.role);
  const isDentist = clinic.role === "dentist";
  const switcher = (
    <WorkspaceSwitcher clinics={clinics} currentClinicId={clinic.id} units={units} activeUnitId={activeUnit?.id ?? null} />
  );
  const userSubtitle = [roleLabels[clinic.role], clinic.cro ? `CRO ${clinic.cro}` : null].filter(Boolean).join(" · ");
  const userMenu = <UserMenu name={user.fullName} email={user.email} subtitle={userSubtitle} />;

  return (
    <div className="min-h-full">
      <Sidebar top={switcher} bottom={userMenu} canManage={canManage} isDentist={isDentist} />
      <MobileNav top={switcher} bottom={userMenu} canManage={canManage} isDentist={isDentist} />
      <CommandMenu canManage={canManage} isDentist={isDentist} />
      <main className="lg:pl-62">
        <SubscriptionBanner
          accessState={clinic.accessState}
          subscriptionStatus={clinic.subscriptionStatus}
          trialEndsAt={clinic.trialEndsAt}
          canManage={canManage}
        />
        {/* A agenda usa a largura toda (sem margens vazias dos lados). */}
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-10 has-[[data-agenda-wide]]:max-w-none lg:has-[[data-agenda-wide]]:py-6">{children}</div>
      </main>
    </div>
  );
}
