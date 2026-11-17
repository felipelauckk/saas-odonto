import "server-only";

import { getClinicalAccess, getToothRecords } from "@/features/clinical/queries";
import { currentState, type Face } from "@/features/clinical/odontogram";
import { createClient } from "@/lib/supabase/server";

import type { Suggestion } from "./components/plan-builder";

/** Profissionais, procedimentos e sugestões do odontograma para montar um orçamento. */
export async function loadBuilderData(patientId: string | null) {
  const supabase = await createClient();
  const [{ data: professionals }, { data: procedures }, access] = await Promise.all([
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
    supabase.from("procedures").select("id, name, price_cents, applies_to_tooth, category").eq("active", true).order("name"),
    getClinicalAccess(),
  ]);

  // Só quem lê o prontuário vê as sugestões (a recepção não vê o odontograma).
  let suggestions: Suggestion[] = [];
  if (patientId && access.canRead) {
    const state = currentState(await getToothRecords(patientId));
    suggestions = [...state.entries()].flatMap(([tooth, s]) => {
      const out: Suggestion[] = [];
      const cariesFaces = (Object.entries(s.faces) as [Face, string][]).filter(([, c]) => c === "caries").map(([f]) => f);
      if (cariesFaces.length) out.push({ tooth, faces: cariesFaces, condition: "caries" });
      if (s.whole === "caries" || s.whole === "other" || s.whole === "missing") out.push({ tooth, faces: [], condition: s.whole });
      return out;
    });
  }

  return {
    professionals: professionals ?? [],
    procedures: procedures ?? [],
    suggestions,
    ownProfessionalId: access.professionals[0]?.id ?? null,
  };
}
