import { z } from "zod";

export const fieldTypes = ["text", "textarea", "number", "date", "select", "yes_no", "table", "perio"] as const;
export type FieldType = (typeof fieldTypes)[number];

export const fieldTypeLabels: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  date: "Data",
  select: "Lista de opções",
  yes_no: "Sim / não",
  table: "Tabela (linhas)",
  perio: "Periograma",
};

export const fieldSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().trim().min(1).max(80),
  type: z.enum(fieldTypes),
  options: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  columns: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]{1,40}$/), label: z.string().trim().min(1).max(40) })).max(12).optional(),
  unit: z.string().max(12).optional(),
});
export type Field = z.infer<typeof fieldSchema>;
export const fieldsSchema = z.array(fieldSchema).max(60).refine((list) => new Set(list.map((f) => f.id)).size === list.length, "Campos repetidos.");

/** Dentes do periograma (permanentes, na ordem do odontograma). */
export const PERIO_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
/** 6 sítios por dente: vestibular (MV, V, DV) e lingual/palatino (ML, L, DL). */
export const PERIO_SITES = ["MV", "V", "DV", "ML", "L", "DL"] as const;

export type PerioTooth = { depth: (number | null)[]; bleeding: boolean[] };
export type PerioChart = Record<string, PerioTooth>;
export type TableRow = Record<string, string>;
export type RecordData = Record<string, string | number | boolean | null | TableRow[] | PerioChart>;

/** Gera um id de campo a partir do rótulo. */
export function slugify(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "campo"
  );
}

/**
 * Limpa as respostas conforme os campos do modelo: só campos conhecidos, no
 * tipo certo; tabelas sem linhas vazias; periograma com valores de 0 a 15 mm.
 */
export function sanitizeData(fields: Field[], data: Record<string, unknown>): RecordData {
  const out: RecordData = {};
  for (const f of fields) {
    const v = data[f.id];
    switch (f.type) {
      case "text":
      case "textarea":
      case "date":
        if (typeof v === "string" && v.trim()) out[f.id] = v.trim().slice(0, f.type === "textarea" ? 4000 : 300);
        break;
      case "select":
        if (typeof v === "string" && f.options?.includes(v)) out[f.id] = v;
        break;
      case "number": {
        const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(",", ".")) : NaN;
        if (Number.isFinite(n)) out[f.id] = n;
        break;
      }
      case "yes_no":
        if (typeof v === "boolean") out[f.id] = v;
        break;
      case "table": {
        if (!Array.isArray(v)) break;
        const cols = f.columns ?? [];
        const rows = v
          .slice(0, 100)
          .map((r) => Object.fromEntries(cols.map((c) => [c.id, typeof r?.[c.id] === "string" ? String(r[c.id]).trim().slice(0, 200) : ""])))
          .filter((r) => Object.values(r).some(Boolean));
        if (rows.length) out[f.id] = rows;
        break;
      }
      case "perio": {
        if (!v || typeof v !== "object") break;
        const chart: PerioChart = {};
        for (const tooth of PERIO_TEETH) {
          const t = (v as Record<string, PerioTooth | undefined>)[String(tooth)];
          if (!t) continue;
          const depth = PERIO_SITES.map((_, i) => {
            const n = Number(t.depth?.[i]);
            return t.depth?.[i] === null || t.depth?.[i] === undefined || !Number.isFinite(n) ? null : Math.min(15, Math.max(0, Math.round(n)));
          });
          const bleeding = PERIO_SITES.map((_, i) => t.bleeding?.[i] === true);
          if (depth.some((d) => d !== null) || bleeding.some(Boolean)) chart[String(tooth)] = { depth, bleeding };
        }
        if (Object.keys(chart).length) out[f.id] = chart;
        break;
      }
    }
  }
  return out;
}

/** Resumo do periograma: sítios com bolsa (≥ 4 mm) e % de sangramento. */
export function perioSummary(chart: PerioChart) {
  let sites = 0;
  let pockets = 0;
  let bleeding = 0;
  for (const t of Object.values(chart)) {
    t.depth.forEach((d, i) => {
      if (d === null && !t.bleeding[i]) return;
      sites++;
      if (d !== null && d >= 4) pockets++;
      if (t.bleeding[i]) bleeding++;
    });
  }
  return { sites, pockets, bleedingRate: sites ? bleeding / sites : 0 };
}
