import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { NewTagButton, TagsList } from "@/features/settings/components/tags-manager";
import { requireManager } from "@/features/tenancy/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Marcadores" };

export default async function Page() {
  await requireManager();
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointment_tags").select("id, name, color, active").order("name");
  if (error) throw error;
  return (
    <div className="space-y-8">
      <SubpageHeader title="Marcadores" description="Etiquetas coloridas para as consultas da agenda." backHref="/configuracoes" backLabel="Configurações" actions={<NewTagButton />} />
      <TagsList tags={data} />
    </div>
  );
}
