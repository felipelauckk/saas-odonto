"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";

import { loadNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from "../actions";

/** Sino com contador e painel das notificações, atualizado em tempo real. */
export function NotificationBell({ clinicId, className }: { clinicId: string; className?: string }) {
  const router = useRouter();
  const channelId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ items: NotificationItem[]; unread: number } | null>(null);
  const [live, setLive] = useState(false);

  const reload = useCallback(() => {
    void loadNotifications().then(setState);
  }, []);

  useEffect(() => {
    reload();
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    // O canal precisa do token do usuário: sem ele, a RLS esconde todos os eventos.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      void supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`notificacoes-${channelId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `clinic_id=eq.${clinicId}` }, reload)
        // "Conectado" só depois que o banco confirma a assinatura das mudanças.
        .on("system", {}, (payload: { extension?: string; status?: string }) => {
          if (!cancelled && payload.extension === "postgres_changes") setLive(payload.status === "ok");
        })
        .subscribe((status) => {
          if (!cancelled && status !== "SUBSCRIBED") setLive(false);
        });
    });
    // Reserva: se o tempo real cair, confere ao voltar para a aba e a cada 2 minutos.
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(reload, 120_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [clinicId, channelId, reload]);

  const unread = state?.unread ?? 0;

  function openItem(n: NotificationItem) {
    if (!n.read) {
      setState((s) => (s ? { items: s.items.map((i) => (i.id === n.id ? { ...i, read: true } : i)), unread: Math.max(0, s.unread - 1) } : s));
      void markNotificationRead(n.id);
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          reload();
        }}
        aria-label={unread ? `Notificações: ${unread} não lidas` : "Notificações"}
        data-live={live || undefined}
        className={cn(
          "relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-muted/60 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring pointer-coarse:size-11",
          className,
        )}
      >
        <Bell className="size-4" aria-hidden />
        {unread ? (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-bold text-white tabular-nums" aria-hidden>
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="type-title">Notificações</SheetTitle>
            <SheetDescription>{unread ? `${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Tudo lido."}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            {unread ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  setState((s) => (s ? { items: s.items.map((i) => ({ ...i, read: true })), unread: 0 } : s));
                  await markAllNotificationsRead();
                }}
              >
                <CheckCheck aria-hidden />
                Marcar todas como lidas
              </Button>
            ) : null}
            {state === null ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : state.items.length ? (
              <ul className="space-y-2" aria-label="Lista de notificações">
                {state.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn("w-full space-y-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-muted", !n.read && "border-primary/40 bg-accent/40")}
                    >
                      <span className="flex items-start gap-2">
                        {!n.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {n.title}
                            {!n.read ? <span className="sr-only"> (não lida)</span> : null}
                          </span>
                          {n.body ? <span className="block text-[0.8125rem] text-muted-foreground">{n.body}</span> : null}
                          <span className="block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação. Agendamentos online, assinaturas, pagamentos online, próteses, estoque baixo e leads do site aparecem aqui.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
