import "server-only";

import { createClient } from "@/lib/supabase/server";

type AuditedTable = "patients" | "anamneses" | "tooth_records" | "clinical_notes" | "patient_files" | "treatment_plans" | "receivables";

/**
 * Registra que o usuário abriu (view) ou exportou (export) um dado sensível.
 * Falha de auditoria nunca impede a tela de abrir.
 */
export async function logAccess(action: "view" | "export", table: AuditedTable, patientId: string | null, recordId: string | null = null) {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_access", {
      _action: action,
      _table_name: table,
      _record_id: recordId as string,
      _patient_id: patientId as string,
    });
  } catch {
    // auditoria é melhor esforço na leitura
  }
}
