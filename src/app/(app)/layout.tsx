import { redirect } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { NoClinicAccess } from "@/features/tenancy/components/no-clinic-access";
import { UserMenu } from "@/features/auth/components/user-menu";
import { ClinicSwitcher } from "@/features/tenancy/components/clinic-switcher";
import { UnitSwitcher } from "@/features/tenancy/components/unit-switcher";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSessionContext();
  if (!session) redirect("/entrar");

  const { user, clinic, clinics, units, activeUnit } = session;
  if (!clinic) return <NoClinicAccess email={user.email} />;

  const canManage = canManageClinic(clinic.role);
  const clinicSwitcher = <ClinicSwitcher clinics={clinics} currentId={clinic.id} />;
  const userMenu = <UserMenu name={user.fullName} email={user.email} />;
  const unitSwitcher = <UnitSwitcher units={units} activeId={activeUnit?.id ?? null} />;
  const hasUnitSwitcher = units.length > 1;

  return (
    <div className="min-h-full">
      <Sidebar top={clinicSwitcher} bottom={userMenu} canManage={canManage} />
      <MobileNav
        top={clinicSwitcher}
        bottom={userMenu}
        actions={hasUnitSwitcher ? unitSwitcher : null}
        canManage={canManage}
      />
      <main className="lg:pl-60">
        {hasUnitSwitcher ? (
          <div className="hidden h-14 items-center justify-end border-b px-8 lg:flex">{unitSwitcher}</div>
        ) : null}
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
