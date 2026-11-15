import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { WaitlistManager } from "@/features/agenda/components/waitlist-manager";
import { requireClinic } from "@/features/tenancy/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lista de espera" };

export default async function Page() {
  await requireClinic();
  const supabase = await createClient();
  const [{ data: entries }, { data: professionals }] = await Promise.all([
    supabase.from("waitlist").select("id, created_at, period, notes, patients(full_name), professionals(name)").eq("status", "waiting").order("created_at"),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
  ]);
  return (
    <div className="space-y-6">
      <SubpageHeader title="Lista de espera" description="Pacientes que querem um horário mais cedo." backHref="/agenda" backLabel="Agenda" />
      <WaitlistManager entries={entries ?? []} professionals={professionals ?? []} />
    </div>
  );
}
