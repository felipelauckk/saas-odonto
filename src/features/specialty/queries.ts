import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { Field, RecordData } from "./fields";

export type SpecialtyTemplate = { id: string; specialty: string; name: string; fields: Field[]; active: boolean };
export type SpecialtyRecord = { id: string; templateId: string; templateName: string; fields: Field[]; data: RecordData; createdAt: string; authorName: string | null; professionalName: string | null };

export async function listTemplates(): Promise<SpecialtyTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("specialty_templates").select("id, specialty, name, fields, active").order("name");
  if (error) throw error;
  return data.map((t) => ({ ...t, fields: t.fields as Field[] }));
}

/**
 * Fichas do paciente: abas = fichas que o profissional do usuário usa (ou
 * todas as ativas, para quem não atende) + qualquer ficha que já tenha registro.
 */
export async function getPatientSpecialty(patientId: string) {
  const supabase = await createClient();
  const [templates, records, own, chosen] = await Promise.all([
    listTemplates(),
    supabase
      .from("specialty_records")
      .select("id, template_id, template_name, fields, data, created_at, filled_by, professionals(name)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase.rpc("current_professional_ids"),
    supabase.from("professional_specialty_forms").select("professional_id, template_id"),
  ]);
  if (records.error) throw records.error;
  const ownIds = new Set((own.data as string[] | null) ?? []);
  const mine = new Set((chosen.data ?? []).filter((c) => ownIds.has(c.professional_id)).map((c) => c.template_id));
  const withRecords = new Set(records.data.map((r) => r.template_id));
  const visible = templates.filter((t) => withRecords.has(t.id) || (t.active && (ownIds.size === 0 || mine.has(t.id) || mine.size === 0)));

  const authorIds = [...new Set(records.data.map((r) => r.filled_by).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = authorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return {
    templates: visible,
    records: records.data.map(
      (r): SpecialtyRecord => ({
        id: r.id,
        templateId: r.template_id,
        templateName: r.template_name,
        fields: r.fields as Field[],
        data: r.data as RecordData,
        createdAt: r.created_at,
        authorName: r.filled_by ? (names.get(r.filled_by) ?? null) : null,
        professionalName: r.professionals?.name ?? null,
      }),
    ),
    ownProfessionalId: [...ownIds][0] ?? null,
  };
}

export async function getFormsSetup() {
  const supabase = await createClient();
  const [templates, pros, chosen] = await Promise.all([
    listTemplates(),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
    supabase.from("professional_specialty_forms").select("professional_id, template_id"),
  ]);
  return { templates, professionals: pros.data ?? [], chosen: chosen.data ?? [] };
}
