import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { Inbox } from "@/features/ai/components/inbox";
import { requireFrontDesk } from "@/features/tenancy/guards";
import { isMessagingConfigured } from "@/lib/messaging";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function Page({ searchParams }: PageProps<"/whatsapp">) {
  await requireFrontDesk();
  const selected = z.uuid().nullable().catch(null).parse((await searchParams).conversa ?? null);
  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone, patient_id, mode, unread, last_message_at, patients(full_name)")
    .order("last_message_at", { ascending: false })
    .limit(100);
  const current = selected ?? conversations?.[0]?.id ?? null;
  const { data: messages } = current
    ? await supabase.from("whatsapp_messages").select("id, author, body, created_at").eq("conversation_id", current).order("created_at").limit(300)
    : { data: [] };
  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp" description="Conversas com os pacientes. O assistente responde quando está ligado; a equipe assume quando quiser." />
      <Inbox conversations={conversations ?? []} selected={current} messages={messages ?? []} simulate={!isMessagingConfigured()} />
    </div>
  );
}
