import type { Metadata } from "next";
import { Info, MessageCircle } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { Badge } from "@/components/ui/badge";
import { CrcTemplatesEditor } from "@/features/crc/components/crc-templates-editor";
import { TemplatesEditor } from "@/features/messaging/components/templates-editor";
import { requireManager } from "@/features/tenancy/guards";
import { formatPhone } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";
import { isMessagingConfigured } from "@/lib/messaging";
import type { MessageKind } from "@/lib/messaging/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensagens" };

const order: MessageKind[] = ["appointment_reminder", "appointment_confirmation", "return_reminder", "birthday"];
const statusLabel = { sent: "Enviada", simulated: "Simulada", failed: "Falhou", received: "Recebida" } as const;
const kindLabel: Record<MessageKind, string> = { appointment_reminder: "Lembrete", appointment_confirmation: "Confirmação", birthday: "Aniversário", return_reminder: "Retorno", payment_reminder: "Cobrança", booking_code: "Código de agendamento" };

export default async function Page() {
  await requireManager();
  const supabase = await createClient();
  const [{ data: templates }, { data: logs }, { data: crcTemplates }] = await Promise.all([
    supabase.from("message_templates").select("id, kind, body, active"),
    supabase
      .from("messages_log")
      .select("id, template_kind, status, to_phone, body, error, sent_at, patients(full_name)")
      .order("sent_at", { ascending: false })
      .limit(50),
    supabase.from("crc_templates").select("queue, body"),
  ]);
  const configured = isMessagingConfigured();
  const sorted = (templates ?? []).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  return (
    <div className="space-y-8">
      <SubpageHeader title="Mensagens" description="Textos enviados aos pacientes pelo WhatsApp e histórico de envios." />

      {!configured ? (
        <div className="flex gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm" role="note">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p>
            <strong className="font-medium">Envio simulado.</strong> O WhatsApp ainda não está configurado: os lembretes ficam registrados
            abaixo, mas nada é enviado. Na API oficial da Meta, os textos precisam ser aprovados como modelos com os mesmos campos.
          </p>
        </div>
      ) : null}

      <TemplatesEditor templates={sorted} />

      <section className="space-y-3" aria-labelledby="crc-mensagens">
        <div>
          <h2 id="crc-mensagens" className="text-base font-medium">Mensagens da CRC</h2>
          <p className="text-sm text-muted-foreground">Texto que já vem pronto ao abrir o WhatsApp em cada fila da CRC. Variáveis: {"{{paciente}}"}, {"{{clinica}}"} e {"{{valor}}"}.</p>
        </div>
        <CrcTemplatesEditor templates={crcTemplates ?? []} />
      </section>

      <section className="space-y-2" aria-labelledby="envios">
        <h2 id="envios" className="text-base font-medium">
          Últimos envios
        </h2>
        {logs?.length ? (
          <ul className="divide-y rounded-xl border">
            {logs.map((l) => (
              <li key={l.id} className="space-y-1 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{l.patients?.full_name ?? "Paciente"}</span>
                  {l.template_kind ? <span className="text-muted-foreground">{kindLabel[l.template_kind]}</span> : null}
                  <Badge variant={l.status === "failed" ? "destructive" : l.status === "sent" ? "default" : "secondary"}>{statusLabel[l.status]}</Badge>
                  <span className="text-muted-foreground">{formatDateTime(l.sent_at)}</span>
                  {l.to_phone ? <span className="text-muted-foreground">{formatPhone(l.to_phone.slice(2))}</span> : null}
                </div>
                {l.body ? <p className="text-sm text-muted-foreground">{l.body}</p> : null}
                {l.error ? <p className="text-sm text-destructive">{l.error}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={MessageCircle} title="Nenhum envio ainda" description="Os lembretes saem todo dia de manhã para as consultas do dia seguinte." />
        )}
      </section>
    </div>
  );
}
