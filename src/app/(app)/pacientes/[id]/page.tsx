import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, CalendarClock, CalendarPlus, ClipboardList, FileText, NotebookPen } from "lucide-react";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import { getClinicalAccess } from "@/features/clinical/queries";
import { PatientNotes } from "@/features/patients/components/patient-notes";
import { ReturnAlertButton } from "@/features/patients/components/return-alert-button";
import { getPatient, getPatientNotes, getPatientOverview } from "@/features/patients/queries";
import { nextVisitLabel } from "@/features/patients/summary";
import { planStatusLabels } from "@/features/plans/labels";
import { canManageClinic } from "@/features/tenancy/roles";
import { requireClinic } from "@/features/tenancy/guards";
import { formatIsoDate } from "@/lib/dates";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resumo do paciente" };

const TINTS = {
  sky: "bg-tint-sky text-tint-sky-foreground",
  mint: "bg-tint-mint text-tint-mint-foreground",
  lilac: "bg-tint-lilac text-tint-lilac-foreground",
  rose: "bg-tint-rose text-tint-rose-foreground",
} as const;

function Card({ title, icon: Icon, tint, action, children }: { title: string; icon: typeof CalendarClock; tint: keyof typeof TINTS; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-card border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-section flex items-center gap-2">
          <span className={cn("flex size-8 items-center justify-center rounded-lg", TINTS[tint])} aria-hidden>
            <Icon className="size-4" />
          </span>
          {title}
        </h2>
        {action}
      </div>
      <div className="text-sm">{children}</div>
    </section>
  );
}

const muted = "text-muted-foreground";

export default async function Page({ params }: PageProps<"/pacientes/[id]">) {
  const session = await requireClinic();
  const { id } = await params;
  const access = await getClinicalAccess();
  const supabase = await createClient();
  const [patient, overview, notes, { data: professionals }] = await Promise.all([
    getPatient(id),
    getPatientOverview(id, access.canRead),
    getPatientNotes(id),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
  ]);
  if (!patient) notFound();
  const archived = Boolean(patient.archived_at);
  const base = `/pacientes/${id}`;
  const small = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        title="Próxima consulta"
        icon={CalendarClock}
        tint="sky"
        action={
          archived ? null : (
            <Link href={`/agenda?paciente=${id}`} className={small}>
              <CalendarPlus aria-hidden />
              Agendar
            </Link>
          )
        }
      >
        {overview.next ? (
          <p>
            <span className="font-semibold">{nextVisitLabel(overview.next.starts_at)}</span>
            <span className={muted}> · {[overview.next.professionals?.name, overview.next.type].filter(Boolean).join(" · ")}</span>
          </p>
        ) : (
          <p className={muted}>Nenhuma consulta marcada.</p>
        )}
      </Card>

      <Card
        title="Alerta de retorno"
        icon={BellRing}
        tint="lilac"
        action={archived ? null : <ReturnAlertButton patient={{ id, name: patient.full_name }} professionals={professionals ?? []} />}
      >
        {overview.pendingReturn ? (
          <p>
            <span className="font-semibold">{formatIsoDate(overview.pendingReturn.due_date)}</span>
            <span className={muted}> · {overview.pendingReturn.reason}</span>
          </p>
        ) : (
          <p className={muted}>Nenhum retorno definido.</p>
        )}
      </Card>

      <Card
        title="Orçamentos em aberto"
        icon={ClipboardList}
        tint="mint"
        action={
          <Link href={`${base}/orcamentos`} className={small}>
            Ver
          </Link>
        }
      >
        {overview.openPlans.length ? (
          <ul className="space-y-1">
            {overview.openPlans.slice(0, 3).map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  {planStatusLabels[p.status]} <span className={muted}>· {formatDate(p.created_at)}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatCurrency(p.total_cents - p.discount_cents)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={muted}>Nenhum orçamento em aberto.</p>
        )}
      </Card>

      {access.canRead ? (
        <Card
          title="Anamnese"
          icon={FileText}
          tint="rose"
          action={
            <Link href={`${base}/anamnese`} className={small}>
              {overview.anamnesisAt ? "Ver" : "Preencher"}
            </Link>
          }
        >
          {overview.anamnesisAt ? <p>Preenchida em {formatDateTime(overview.anamnesisAt)}</p> : <p className={muted}>Ainda não preenchida.</p>}
        </Card>
      ) : null}

      <PatientNotes patientId={id} notes={notes} userId={session.user.id} canManage={canManageClinic(session.clinic.role)} />

      {access.canRead ? (
        <Card
          title="Últimas evoluções"
          icon={NotebookPen}
          tint="sky"
          action={
            <Link href={`${base}/evolucoes`} className={small}>
              Ver todas
            </Link>
          }
        >
          {overview.evolutions.length ? (
            <ul className="space-y-2">
              {overview.evolutions.map((e) => (
                <li key={e.id} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(e.created_at)}
                    {e.professionals?.name ? ` · ${e.professionals.name}` : ""}
                  </p>
                  <p className="line-clamp-2">{e.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={muted}>Nenhuma evolução registrada.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
