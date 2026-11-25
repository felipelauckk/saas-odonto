import type { Metadata } from "next";
import QRCode from "qrcode";

import { FormSection, FormSections } from "@/components/forms/form-sections";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { BookingSettings, PrintQrButton } from "@/features/booking/components/booking-settings";
import { requireManager } from "@/features/tenancy/guards";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agendamento online e check-in" };

export default async function Page() {
  const session = await requireManager();
  const supabase = await createClient();
  const [{ data: settings }, { data: pros }, { data: procs }, { data: units }, site] = await Promise.all([
    supabase.from("online_booking_settings").select("enabled, slug, intro, professional_ids, procedure_ids, default_duration_min, min_notice_hours, max_days_ahead").eq("clinic_id", session.clinic.id).maybeSingle(),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
    supabase.from("procedures").select("id, name, duration_min").eq("active", true).order("name"),
    supabase.from("units").select("id, name, checkin_token").eq("active", true).order("name"),
    getSiteUrl(),
  ]);
  const qrs = await Promise.all(
    (units ?? []).map(async (u) => ({ name: u.name, url: `${site}/checkin/${u.checkin_token}`, svg: await QRCode.toString(`${site}/checkin/${u.checkin_token}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) })),
  );
  return (
    <div className="space-y-8">
      <SubpageHeader title="Agendamento online e check-in" description="Página pública para o paciente marcar consulta e QR Code de chegada na recepção." backHref="/configuracoes" backLabel="Configurações" />
      {settings ? <BookingSettings settings={settings} site={site} professionals={pros ?? []} procedures={procs ?? []} /> : <p className="text-sm text-muted-foreground">Configuração indisponível.</p>}
      <FormSections className="print:border-0 print:shadow-none">
        <FormSection
          id="checkin"
          title="QR Code de check-in"
          description="Imprima e deixe na recepção. O paciente lê com a câmera, digita o telefone e confirma a chegada; na agenda o status muda para “Chegou”."
          className="print:block"
        >
          <div className="flex justify-end print:hidden">
            <PrintQrButton />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {qrs.map((q) => (
              <figure key={q.url} className="space-y-2 rounded-xl border p-4 text-center break-inside-avoid">
                <div className="mx-auto w-48 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`QR Code de check-in da unidade ${q.name}`} dangerouslySetInnerHTML={{ __html: q.svg }} />
                <figcaption className="text-sm">
                  <span className="block font-medium">Chegou? Faça seu check-in</span>
                  <span className="text-muted-foreground">{q.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </FormSection>
      </FormSections>
    </div>
  );
}
