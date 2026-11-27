/**
 * Origens do paciente e do lead ("como conheceu a clínica"): lista por clínica
 * em patient_sources. As padrões têm "key" (indicacao, instagram...).
 */

export type PatientSourceOption = { id: string; name: string; key: string | null; active: boolean; position: number };

/** Cor da etiqueta: Instagram e Google mantêm as cores de sempre; as outras seguem a paleta pela posição. */
const FIXED: Record<string, string> = {
  instagram: "bg-source-instagram-soft text-source-instagram",
  google: "bg-source-google-soft text-source-google",
  indicacao: "bg-success-soft text-success",
  site: "bg-accent text-accent-foreground",
};

const PALETTE = [
  "bg-tint-sky text-tint-sky-foreground",
  "bg-tint-mint text-tint-mint-foreground",
  "bg-tint-lilac text-tint-lilac-foreground",
  "bg-tint-peach text-tint-peach-foreground",
  "bg-tint-rose text-tint-rose-foreground",
  "bg-warning-soft text-warning",
];

export function sourcePillClass(source: Pick<PatientSourceOption, "key" | "position"> | null | undefined): string {
  if (!source) return "bg-muted text-muted-foreground";
  if (source.key && FIXED[source.key]) return FIXED[source.key]!;
  if (source.key === "outro") return "bg-muted text-muted-foreground";
  return PALETTE[source.position % PALETTE.length]!;
}

/** Opções de um seletor: as ativas, mais a atual se tiver sido desativada (para não sumir do cadastro). */
export function sourceOptions(sources: PatientSourceOption[], currentId?: string | null) {
  return sources.filter((s) => s.active || s.id === currentId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/** Indicação libera o campo "Indicado por". */
export const isReferral = (source: Pick<PatientSourceOption, "key"> | null | undefined) => source?.key === "indicacao";
