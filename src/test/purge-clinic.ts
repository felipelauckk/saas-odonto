/**
 * Apaga uma clínica de teste e tudo que é dela (banco e Storage), na ordem
 * certa das chaves estrangeiras. Usado pelos testes de banco (Vitest) e de
 * tela (Playwright): uma lista só, para nenhuma tabela nova ficar de fora.
 *
 * Ao criar uma tabela nova com clinic_id, inclua aqui (antes das tabelas de
 * que ela depende). Se a clínica não puder ser apagada, a função avisa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CLINIC_TABLES = [
  "audit_log",
  "ai_insights",
  "ai_usage_log",
  "whatsapp_messages",
  "whatsapp_conversations",
  "clinic_ai_settings",
  "service_invoices",
  "clinic_fiscal_settings",
  "booking_requests",
  "portal_links",
  "online_booking_settings",
  "specialty_records",
  "professional_specialty_forms",
  "specialty_templates",
  "goals",
  "stock_movements",
  "stock_lots",
  "procedure_kits",
  "stock_products",
  "prosthetic_orders",
  "lab_services",
  "labs",
  "dunning_log",
  "dunning_steps",
  "patient_charges",
  "clinic_billing",
  "crc_contacts",
  "leads",
  "crm_campaigns",
  "crm_stages",
  "crc_templates",
  "signature_requests",
  "patient_documents",
  "document_templates",
  "medications",
  "messages_log",
  "message_templates",
  "commission_closings",
  "commission_rules",
  "bank_transactions",
  "cash_movements",
  "payables",
  "suppliers",
  "cost_centers",
  "finance_categories",
  "patient_credits",
  "receivables",
  "patient_subscriptions",
  "plan_item_sessions",
  "treatment_plans",
  "clinical_notes",
  "anamneses",
  "tooth_records",
  "patient_files",
  "patient_file_folders",
  "patient_notes",
  "patient_returns",
  "waitlist",
  "appointment_tag_links",
  "appointment_tags",
  "appointments",
  "schedule_blocks",
  "professional_schedules",
  "professionals",
  "chairs",
  "procedures",
  "payment_methods",
  "anamnesis_templates",
  "patient_phones",
  "patients",
  "patient_sources",
  "referral_partners",
] as const;

export async function purgeClinic(admin: SupabaseClient, clinicId: string): Promise<void> {
  const storage = admin.storage.from("clinic");
  // Arquivos guardados no Storage: as leituras vão juntas, numa ida só.
  const [files, bills, docs, sigs, closings, logo, photos] = await Promise.all([
    admin.from("patient_files").select("storage_path").eq("clinic_id", clinicId),
    admin.from("payables").select("attachment_path").eq("clinic_id", clinicId).not("attachment_path", "is", null),
    admin.from("patient_documents").select("pdf_path").eq("clinic_id", clinicId),
    admin.from("signature_requests").select("signed_pdf_path, signature_path").eq("clinic_id", clinicId),
    admin.from("commission_closings").select("pdf_path").eq("clinic_id", clinicId).not("pdf_path", "is", null),
    storage.list(`${clinicId}/logo`),
    admin.from("patients").select("photo_path").eq("clinic_id", clinicId).not("photo_path", "is", null),
  ]);
  const paths: string[] = [
    ...((files.data ?? []) as { storage_path: string }[]).map((f) => f.storage_path),
    ...((bills.data ?? []) as { attachment_path: string }[]).map((b) => b.attachment_path),
    ...((docs.data ?? []) as { pdf_path: string | null }[]).map((d) => d.pdf_path).filter((p): p is string => Boolean(p)),
    ...((sigs.data ?? []) as { signed_pdf_path: string | null; signature_path: string | null }[]).flatMap((s) =>
      [s.signed_pdf_path, s.signature_path].filter((p): p is string => Boolean(p)),
    ),
    ...((closings.data ?? []) as { pdf_path: string }[]).map((c) => c.pdf_path),
    ...(logo.data ?? []).map((f) => `${clinicId}/logo/${f.name}`),
    ...((photos.data ?? []) as { photo_path: string }[]).map((p) => p.photo_path),
  ];
  if (paths.length) await storage.remove(paths);

  for (const table of CLINIC_TABLES) await admin.from(table).delete().eq("clinic_id", clinicId);
  // As exclusões acima geram registros de auditoria (gatilhos): apaga de novo antes da clínica.
  await admin.from("audit_log").delete().eq("clinic_id", clinicId);
  await admin.from("clinic_members").delete().eq("clinic_id", clinicId);
  await admin.from("profiles").update({ active_clinic_id: null }).eq("active_clinic_id", clinicId);
  await admin.from("units").delete().eq("clinic_id", clinicId);
  const { error } = await admin.from("clinics").delete().eq("id", clinicId);
  if (error) throw new Error(`Clínica de teste ${clinicId} não foi apagada: ${error.message}. Falta alguma tabela em CLINIC_TABLES?`);
}
