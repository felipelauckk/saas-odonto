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
import { getNews } from "@/features/help/content";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { createClient } from "@/lib/supabase/server";

/** Alguma novidade mais nova do que a última que a pessoa viu? */
async function hasUnseenNews(userId: string): Promise<boolean> {
  const [news, supabase] = await Promise.all([getNews(), createClient()]);
  if (!news[0]) return false;
  const { data } = await supabase.from("profiles").select("news_seen_at").eq("id", userId).maybeSingle();
  return !data?.news_seen_at || data.news_seen_at.slice(0, 10) < news[0].date;
}

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
  const hasNews = await hasUnseenNews(user.id);

  return (
    <div className="min-h-full">
      <Sidebar top={switcher} bottom={userMenu} bell={<NotificationBell clinicId={clinic.id} className="max-lg:hidden" />} hasNews={hasNews} canManage={canManage} isDentist={isDentist} />
      <MobileNav top={switcher} bottom={userMenu} bell={<NotificationBell clinicId={clinic.id} className="lg:hidden" />} hasNews={hasNews} canManage={canManage} isDentist={isDentist} />
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
