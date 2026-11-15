"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, MessageCircle, UserRound } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import { markConversationRead, sendStaffReply, setConversationMode, simulateInbound } from "../actions";

type Conversation = { id: string; phone: string; patient_id: string | null; mode: "bot" | "human"; unread: number; last_message_at: string; patients: { full_name: string } | null };
type Message = { id: string; author: "patient" | "bot" | "staff" | "system"; body: string; created_at: string };

const authorLabel = { patient: "Paciente", bot: "Assistente", staff: "Equipe", system: "Sistema" } as const;

export function Inbox({ conversations, selected, messages, simulate }: { conversations: Conversation[]; selected: string | null; messages: Message[]; simulate: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = conversations.find((c) => c.id === selected) ?? null;

  // Novas mensagens aparecem sozinhas (tempo real).
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel("whatsapp-inbox")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 300);
        })
        .subscribe();
    });
    return () => {
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    if (current?.unread) void markConversationRead(current.id);
  }, [current?.id, current?.unread]);

  return (
    <div className="space-y-4">
      {simulate ? <Simulator onDone={() => router.refresh()} /> : null}
      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <nav aria-label="Conversas" className="space-y-1">
          {conversations.length ? (
            conversations.map((c) => (
              <Link key={c.id} href={`/whatsapp?conversa=${c.id}`} aria-current={c.id === selected ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", c.id === selected ? "border-primary bg-accent" : "hover:bg-muted")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.patients?.full_name ?? formatPhone(c.phone)}</span>
                  <span className="block text-xs text-muted-foreground">{formatDateTime(c.last_message_at)}</span>
                </span>
                {c.mode === "bot" ? <Bot className="size-4 text-muted-foreground" aria-label="Com o assistente" /> : <UserRound className="size-4 text-muted-foreground" aria-label="Com a equipe" />}
                {c.unread ? <Badge>{c.unread}</Badge> : null}
              </Link>
            ))
          ) : (
            <EmptyState icon={MessageCircle} title="Nenhuma conversa" description="As mensagens dos pacientes pelo WhatsApp aparecem aqui." />
          )}
        </nav>

        {current ? (
          <section aria-label="Conversa" className="flex min-h-96 flex-col rounded-xl border">
            <header className="flex flex-wrap items-center gap-2 border-b p-3">
              <span className="flex-1 font-medium">
                {current.patient_id ? <Link href={`/pacientes/${current.patient_id}`} className="hover:underline">{current.patients?.full_name}</Link> : formatPhone(current.phone)}
              </span>
              <Badge variant="secondary">{current.mode === "bot" ? "Com o assistente" : "Com a equipe"}</Badge>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
                const r = await setConversationMode(current.id, current.mode === "bot" ? "human" : "bot");
                setError(r.error ?? null);
              })}>
                {current.mode === "bot" ? "Assumir conversa" : "Devolver ao assistente"}
              </Button>
            </header>
            <ol className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.map((m) => (
                <li key={m.id} className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm", m.author === "patient" ? "bg-muted" : m.author === "system" ? "mx-auto bg-transparent text-center text-xs text-muted-foreground" : "ml-auto bg-primary/10")}>
                  {m.author !== "system" ? <span className="block text-xs text-muted-foreground">{authorLabel[m.author]} · {formatDateTime(m.created_at)}</span> : null}
                  <span className="whitespace-pre-line">{m.body}</span>
                </li>
              ))}
            </ol>
            <div className="space-y-2 border-t p-3">
              {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
              <Label htmlFor="inbox-reply" className="sr-only">Responder</Label>
              <Textarea id="inbox-reply" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva a resposta (ao enviar, a equipe assume a conversa)" />
              <Button disabled={pending || !text.trim()} onClick={() => startTransition(async () => {
                const r = await sendStaffReply(current.id, text);
                if (r.error) setError(r.error);
                else {
                  setText("");
                  setError(null);
                }
              })}>
                Enviar
              </Button>
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Escolha uma conversa.</p>
        )}
      </div>
    </div>
  );
}

function Simulator({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <details className="rounded-xl border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Testar o assistente (WhatsApp ainda não configurado)</summary>
      <div className="mt-3 space-y-2">
        {message ? <FormMessage state={message} /> : null}
        <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
          <Input aria-label="Telefone do paciente (teste)" placeholder="(11) 98888-7777" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input aria-label="Mensagem do paciente (teste)" placeholder="Oi, queria marcar uma avaliação" value={text} onChange={(e) => setText(e.target.value)} />
          <Button disabled={pending} onClick={() => startTransition(async () => {
            const r = await simulateInbound(phone, text);
            setMessage(r.error ? { status: "error", message: r.error } : { status: "success", message: r.reply ? `Assistente: ${r.reply}` : "Mensagem recebida (a conversa está com a equipe ou o assistente está desligado)." });
            if (!r.error) {
              setText("");
              onDone();
            }
          })}>
            {pending ? "Enviando..." : "Simular"}
          </Button>
        </div>
      </div>
    </details>
  );
}
