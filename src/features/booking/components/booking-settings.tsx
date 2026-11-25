"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, Printer } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { FormSection, FormSections, FormSectionsFooter } from "@/components/forms/form-sections";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { saveBookingSettings } from "../actions";

type Settings = {
  enabled: boolean;
  slug: string;
  intro: string | null;
  professional_ids: string[];
  procedure_ids: string[];
  default_duration_min: number;
  min_notice_hours: number;
  max_days_ahead: number;
};

export function BookingSettings({ settings, site, professionals, procedures }: { settings: Settings; site: string; professionals: { id: string; name: string }[]; procedures: { id: string; name: string; duration_min: number }[] }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [slug, setSlug] = useState(settings.slug);
  const [intro, setIntro] = useState(settings.intro ?? "");
  const [pros, setPros] = useState<string[]>(settings.professional_ids);
  const [procs, setProcs] = useState<string[]>(settings.procedure_ids);
  const [duration, setDuration] = useState(String(settings.default_duration_min));
  const [notice, setNotice] = useState(String(settings.min_notice_hours));
  const [ahead, setAhead] = useState(String(settings.max_days_ahead));
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const url = `${site}/agendar/${settings.slug}`;
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));

  return (
    <FormSections className="print:hidden">
      <FormSection id="bs-situacao" title="Agendamento online" description="Página pública para o paciente marcar consulta sozinho.">
        {message ? <FormMessage state={message} /> : null}
        <Label className="flex items-center gap-3 font-normal pointer-coarse:min-h-11">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          {enabled ? "Agendamento online ligado" : "Agendamento online desligado"}
        </Label>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Link para Instagram e Google Meu Negócio</p>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={url} aria-label="Link de agendamento" className="min-w-0 flex-[1_1_16rem]" />
            <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}><Copy aria-hidden />{copied ? "Copiado" : "Copiar"}</Button>
            <a href={url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}><ExternalLink aria-hidden />Abrir</a>
          </div>
        </div>
      </FormSection>

      <FormSection id="bs-regras" title="Endereço e regras" description="Quanto tempo antes e até quando o paciente pode marcar.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bs-slug">Endereço (depois de /agendar/)</Label>
            <Input id="bs-slug" value={slug} maxLength={60} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-duration">Duração padrão (min)</Label>
            <Input id="bs-duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-notice">Antecedência mínima (horas)</Label>
            <Input id="bs-notice" inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-ahead">Até quantos dias à frente</Label>
            <Input id="bs-ahead" inputMode="numeric" value={ahead} onChange={(e) => setAhead(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bs-intro">Texto de abertura (opcional)</Label>
          <Textarea id="bs-intro" maxLength={500} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Ex.: Agende sua avaliação gratuita." />
        </div>
      </FormSection>

      <FormSection id="bs-profissionais" title="Profissionais" description="Nenhum marcado: aparecem todos.">
        <fieldset>
          <legend className="sr-only">Profissionais que aparecem</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {professionals.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
                <Checkbox checked={pros.includes(p.id)} onCheckedChange={(v) => setPros((l) => toggle(l, p.id, Boolean(v)))} />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection id="bs-tipos" title="Tipos de consulta" description="Nenhum marcado: consulta com a duração padrão.">
        <fieldset>
          <legend className="sr-only">Tipos de consulta oferecidos</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {procedures.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
                <Checkbox checked={procs.includes(p.id)} onCheckedChange={(v) => setProcs((l) => toggle(l, p.id, Boolean(v)))} />
                {p.name} <span className="text-muted-foreground">({p.duration_min} min)</span>
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSectionsFooter>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveBookingSettings({
                enabled,
                slug,
                intro,
                professionalIds: pros,
                procedureIds: procs,
                defaultDurationMin: Number(duration),
                minNoticeHours: Number(notice),
                maxDaysAhead: Number(ahead),
              });
              setMessage(r.error ? { status: "error", message: r.error } : { status: "success", message: "Configuração salva." });
            })
          }
        >
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </FormSectionsFooter>
    </FormSections>
  );
}

export function PrintQrButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden />
      Imprimir
    </Button>
  );
}
