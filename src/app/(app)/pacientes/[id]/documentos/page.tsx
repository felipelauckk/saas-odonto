import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/feedback/empty-state";
import { getClinicalAccess } from "@/features/clinical/queries";
import { DocumentsList } from "@/features/documents/components/documents-list";
import { NewDocumentButton } from "@/features/documents/components/new-document";
import { SendLinkDialog } from "@/features/documents/components/send-link-dialog";
import { documentKinds, type DocumentKind } from "@/features/documents/labels";
import { listMedications, listPatientDocuments, listUsableTemplates } from "@/features/documents/queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documentos" };

export default async function Page({ params, searchParams }: PageProps<"/pacientes/[id]/documentos">) {
  const { id } = await params;
  const { novo, orcamento } = await searchParams;
  const supabase = await createClient();
  const access = await getClinicalAccess();

  const [{ documents, requests }, templates, medications, { data: allProfessionals }, { data: procedures }, { data: plans }] = await Promise.all([
    listPatientDocuments(id),
    listUsableTemplates(access.canWrite),
    listMedications(),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
    supabase.from("procedures").select("id, name").eq("active", true).order("name"),
    supabase.from("treatment_plans").select("id, created_at, total_cents, status").eq("patient_id", id).neq("status", "rejected").order("created_at", { ascending: false }),
  ]);

  const initialKind = documentKinds.includes(novo as DocumentKind) ? (novo as DocumentKind) : null;
  const initialPlanId = z.uuid().safeParse(orcamento).success ? (orcamento as string) : null;

  const actions = (
    <div className="flex flex-wrap justify-end gap-2">
      <SendLinkDialog patientId={id} documentId={null} label="anamnese" triggerLabel="Enviar anamnese por link" />
      <NewDocumentButton
        patientId={id}
        templates={templates}
        ownProfessionals={access.professionals}
        allProfessionals={allProfessionals ?? []}
        procedures={procedures ?? []}
        plans={(plans ?? []).map((p) => ({ id: p.id, name: `Orçamento de ${formatDate(p.created_at)} · ${formatCurrency(p.total_cents)}` }))}
        medications={medications}
        initialKind={initialKind}
        initialPlanId={initialPlanId}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {actions}
      {documents.length || requests.length ? (
        <DocumentsList patientId={id} documents={documents} requests={requests} />
      ) : (
        <EmptyState icon={FileText} title="Nenhum documento" description="Receitas, atestados, contratos e termos emitidos para este paciente aparecem aqui." />
      )}
    </div>
  );
}
