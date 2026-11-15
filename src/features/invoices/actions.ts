"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getClinicCredentials } from "@/features/charges/service";
import { getSessionContext } from "@/features/tenancy/queries";
import { AsaasClinicError, saveFiscalInfo } from "@/lib/asaas-clinic";
import { formValues, type ActionState } from "@/lib/action-state";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { cancelServiceInvoice, issueInvoice } from "./service";

type Result = { error?: string };

async function context(managersOnly = false) {
  const session = await getSessionContext();
  const role = session?.clinic?.role;
  if (!session?.clinic || role === "dentist") return null;
  if (managersOnly && role !== "owner" && role !== "manager") return null;
  return { session, clinicId: session.clinic.id, userId: session.user.id, supabase: await createClient() };
}

function refresh() {
  revalidatePath("/financeiro", "layout");
}

export async function issueInvoiceAction(receivableId: string): Promise<Result> {
  if (!z.uuid().safeParse(receivableId).success) return { error: "Recebimento inválido." };
  const ctx = await context();
  if (!ctx) return { error: "Sem permissão." };
  const r = await issueInvoice(ctx, receivableId);
  refresh();
  return r.error ? { error: r.error } : {};
}

export async function cancelInvoiceAction(invoiceId: string): Promise<Result> {
  if (!z.uuid().safeParse(invoiceId).success) return { error: "Nota inválida." };
  const ctx = await context(true);
  if (!ctx) return { error: "Só a gestão cancela notas." };
  const r = await cancelServiceInvoice(ctx, invoiceId);
  refresh();
  return r;
}

const fiscalSchema = z.object({
  enabled: z.string().optional().transform((v) => v === "on"),
  auto_issue: z.string().optional().transform((v) => v === "on"),
  municipal_inscription: z.string().trim().max(30).transform((v) => v || null),
  simples_nacional: z.string().optional().transform((v) => v === "on"),
  cnae: z.string().trim().max(20).transform((v) => v || null),
  municipal_service_code: z.string().trim().min(1, "Informe o código do serviço na prefeitura.").max(30),
  municipal_service_name: z.string().trim().max(300).transform((v) => v || null),
  service_description: z.string().trim().min(3, "Descreva o serviço.").max(500),
  iss_rate: z.string().transform((v, c) => {
    const n = Number(v.replace(",", ".") || "0");
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      c.addIssue({ code: "custom", message: "Alíquota entre 0 e 10%." });
      return z.NEVER;
    }
    return n;
  }),
  retain_iss: z.string().optional().transform((v) => v === "on"),
  email: z.string().trim().max(160),
  certificate_password: z.string().max(200),
});

/**
 * Salva a configuração fiscal e envia os dados (e o certificado A1, se
 * anexado) ao Asaas. O certificado e a senha não são guardados aqui.
 */
export async function saveFiscalSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = fiscalSchema.safeParse({ municipal_inscription: "", cnae: "", municipal_service_name: "", iss_rate: "", email: "", certificate_password: "", ...values });
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const ctx = await context(true);
  if (!ctx) return { status: "error", message: "Só a gestão configura a nota fiscal.", values };
  const { email, certificate_password, ...row } = parsed.data;
  const { error } = await ctx.supabase.from("clinic_fiscal_settings").upsert({ clinic_id: ctx.clinicId, ...row });
  if (error) return { status: "error", message: subscriptionErrorMessage(error) ?? "Não foi possível salvar.", values };

  const file = formData.get("certificate");
  const certificate = file instanceof File && file.size > 0 ? file : null;
  if (certificate && certificate.size > 200_000) return { status: "error", message: "Certificado grande demais (o A1 tem poucos KB).", values };
  if (certificate && !certificate_password) return { status: "error", message: "Informe a senha do certificado.", fieldErrors: { certificate_password: ["Informe a senha do certificado."] }, values };
  const cred = await getClinicCredentials(ctx.clinicId);
  if (cred && row.municipal_inscription && email) {
    try {
      await saveFiscalInfo(cred, {
        email,
        municipalInscription: row.municipal_inscription,
        simplesNacional: row.simples_nacional,
        cnae: row.cnae,
        serviceListItem: row.municipal_service_code,
        certificate: certificate ? { file: certificate, fileName: certificate.name, password: certificate_password } : null,
      });
      await createAdminClient().from("clinic_fiscal_settings").update({ synced_at: new Date().toISOString() }).eq("clinic_id", ctx.clinicId);
    } catch (e) {
      return { status: "error", message: `Configuração salva, mas o Asaas recusou os dados fiscais: ${e instanceof AsaasClinicError ? e.message : "erro de comunicação"}.`, values };
    }
  }
  revalidatePath("/configuracoes/nota-fiscal");
  return { status: "success", message: cred ? "Configuração salva e enviada ao Asaas." : "Configuração salva. Conecte o Asaas em Cobrança online para emitir." };
}
