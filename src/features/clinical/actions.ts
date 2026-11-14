"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

import { answersSchema, questionsSchema } from "./anamnesis";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES } from "./files";
import { ARCHES, WHOLE_TOOTH, conditions } from "./odontogram";

type Result = { error?: string };

const VALID_TEETH = new Set<number>(Object.values(ARCHES).flat());
const NO_PERMISSION = "Você não tem permissão para registrar no prontuário.";

async function context() {
  const session = await getSessionContext();
  if (!session?.clinic) return null;
  return { session, clinicId: session.clinic.id, supabase: await createClient() };
}

const patientPath = (patientId: string, tab: string) => `/pacientes/${patientId}/${tab}`;

// Anamnese -------------------------------------------------------------------------

export async function saveAnamnesis(input: { patientId: string; templateId: string | null; answers: unknown }): Promise<Result> {
  const parsed = z
    .object({ patientId: z.uuid(), templateId: z.uuid().nullable(), answers: answersSchema })
    .safeParse(input);
  if (!parsed.success) return { error: "Respostas inválidas." };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const missingDetails = parsed.data.answers.find((a) => a.alert && a.details && a.answer === "yes" && !a.text);
  if (missingDetails) return { error: `Detalhe a resposta: “${missingDetails.label}”.` };

  const { error } = await ctx.supabase.from("anamneses").insert({
    clinic_id: ctx.clinicId,
    patient_id: parsed.data.patientId,
    template_id: parsed.data.templateId,
    answers: parsed.data.answers,
    filled_by: ctx.session.user.id,
  });
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : subscriptionErrorMessage(error) ?? "Não foi possível salvar a anamnese." };

  revalidatePath(`/pacientes/${parsed.data.patientId}`, "layout");
  return {};
}

// Odontograma ------------------------------------------------------------------------

const toothRecordSchema = z.object({
  patientId: z.uuid(),
  tooth: z.number().int().refine((t) => VALID_TEETH.has(t), "Dente inválido."),
  faces: z.array(z.enum(["M", "D", "O", "V", "L"])).max(5),
  condition: z.enum(conditions),
  notes: z.string().trim().max(1000).optional(),
});

export async function addToothRecord(input: z.input<typeof toothRecordSchema>): Promise<Result> {
  const parsed = toothRecordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { patientId, tooth, condition, notes } = parsed.data;
  // Condições do dente inteiro ignoram faces.
  const faces = WHOLE_TOOTH.includes(condition) ? [] : [...new Set(parsed.data.faces)];

  const { error } = await ctx.supabase.from("tooth_records").insert({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    tooth,
    faces,
    condition,
    notes: notes || null,
    recorded_by: ctx.session.user.id,
  });
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : subscriptionErrorMessage(error) ?? "Não foi possível registrar." };

  revalidatePath(patientPath(patientId, "odontograma"));
  return {};
}

// Evoluções ---------------------------------------------------------------------------

const noteSchema = z.object({
  patientId: z.uuid(),
  professionalId: z.uuid({ message: "Escolha o profissional." }),
  body: z.string().trim().min(3, "Escreva a evolução.").max(10_000, "Texto muito longo."),
  complementsNoteId: z.uuid().nullable().optional(),
});

export async function addClinicalNote(input: z.input<typeof noteSchema>): Promise<Result> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { patientId, professionalId, body, complementsNoteId } = parsed.data;
  const { error } = await ctx.supabase.from("clinical_notes").insert({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    professional_id: professionalId,
    body,
    complements_note_id: complementsNoteId ?? null,
    created_by: ctx.session.user.id,
  });
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : subscriptionErrorMessage(error) ?? "Não foi possível salvar a evolução." };

  revalidatePath(patientPath(patientId, "evolucoes"));
  return {};
}

// Arquivos ------------------------------------------------------------------------------


/** Caminho no Storage para um arquivo novo. O navegador envia direto para lá. */
export async function prepareUpload(input: { patientId: string; fileName: string; mimeType: string; size: number }): Promise<{ path?: string; error?: string }> {
  const parsed = z
    .object({ patientId: z.uuid(), fileName: z.string().max(200), mimeType: z.string(), size: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success) return { error: "Arquivo inválido." };
  if (!ALLOWED_FILE_TYPES.includes(parsed.data.mimeType)) return { error: "Envie imagens (JPG, PNG, WebP, HEIC) ou PDF." };
  if (parsed.data.size > MAX_FILE_BYTES) return { error: "Cada arquivo pode ter no máximo 20 MB." };

  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };
  const { data: canWrite } = await ctx.supabase.rpc("can_write_clinical");
  if (!canWrite) return { error: NO_PERMISSION };

  const ext = parsed.data.fileName.includes(".") ? parsed.data.fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return { path: `${ctx.clinicId}/patients/${parsed.data.patientId}/${randomUUID()}${ext ? `.${ext}` : ""}` };
}

const registerSchema = z.object({
  patientId: z.uuid(),
  path: z.string().min(10).max(300),
  kind: z.enum(["photo", "xray", "document", "other"]),
  description: z.string().trim().max(300).optional(),
  mimeType: z.string().max(100),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
});

/** Registra no prontuário um arquivo que o navegador já enviou ao Storage. */
export async function registerPatientFile(input: z.input<typeof registerSchema>): Promise<Result> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados do arquivo inválidos." };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { patientId, path, kind, description, mimeType, size } = parsed.data;
  if (!path.startsWith(`${ctx.clinicId}/patients/${patientId}/`)) return { error: "Caminho de arquivo inválido." };

  const { error } = await ctx.supabase.from("patient_files").insert({
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    storage_path: path,
    kind,
    description: description || null,
    mime_type: mimeType,
    size_bytes: size,
    uploaded_by: ctx.session.user.id,
  });
  if (error) {
    // Sem registro, o arquivo enviado ficaria órfão: remove (o app não tem DELETE no bucket).
    await createAdminClient().storage.from("clinic").remove([path]);
    return { error: error.code === "42501" ? NO_PERMISSION : subscriptionErrorMessage(error) ?? "Não foi possível salvar o arquivo." };
  }

  revalidatePath(patientPath(patientId, "arquivos"));
  return {};
}

// Modelo de anamnese (Configurações) -----------------------------------------------------

export async function saveAnamnesisTemplate(input: { templateId: string; questions: unknown }): Promise<Result> {
  const parsed = z.object({ templateId: z.uuid(), questions: questionsSchema }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Perguntas inválidas." };
  if (!parsed.data.questions.length) return { error: "O modelo precisa de pelo menos uma pergunta." };

  const session = await getSessionContext();
  if (!session?.clinic || !canManageClinic(session.clinic.role)) {
    return { error: "Você não tem permissão para alterar o modelo." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anamnesis_templates")
    .update({ questions: parsed.data.questions })
    .eq("id", parsed.data.templateId)
    .select("id");
  if (error || !data.length) return { error: "Não foi possível salvar o modelo." };

  revalidatePath("/configuracoes/anamnese");
  return {};
}
