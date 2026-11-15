import { z } from "zod";

import { addDays } from "@/lib/timezone";

import type { ReportDef } from "./catalog";
import type { ReportFilters } from "./types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Lê os filtros da URL (de, ate, unidade, profissional, meses, agrupar) com padrões seguros. */
export function parseReportFilters(def: ReportDef, params: Record<string, string | string[] | undefined>, today: string): ReportFilters {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;
  const to = isoDate.catch(def.slug === "aniversariantes" ? addDays(today, 30) : today).parse(one("ate"));
  const defaultFrom = def.slug === "aniversariantes" ? today : `${today.slice(0, 7)}-01`;
  let from = isoDate.catch(defaultFrom).parse(one("de"));
  if (from > to) from = to;
  // Período máximo de 2 anos (desempenho).
  if (from < addDays(to, -731)) from = addDays(to, -731);
  const groups = def.groupBy?.map((g) => g.value) ?? [];
  return {
    from,
    to,
    unitId: z.uuid().nullable().catch(null).parse(one("unidade") || null),
    professionalId: z.uuid().nullable().catch(null).parse(one("profissional") || null),
    months: z.coerce.number().int().min(1).max(60).catch(6).parse(one("meses")),
    groupBy: groups.includes(one("agrupar") ?? "") ? one("agrupar")! : (groups[0] ?? ""),
  };
}

/** Parâmetros da URL a partir dos filtros (para o link de exportação). */
export function filtersToQuery(def: ReportDef, f: ReportFilters): string {
  const q = new URLSearchParams();
  if (def.filters.includes("period")) {
    q.set("de", f.from);
    q.set("ate", f.to);
  }
  if (def.filters.includes("unit") && f.unitId) q.set("unidade", f.unitId);
  if (def.filters.includes("professional") && f.professionalId) q.set("profissional", f.professionalId);
  if (def.filters.includes("months")) q.set("meses", String(f.months));
  if (def.filters.includes("groupBy") && f.groupBy) q.set("agrupar", f.groupBy);
  return q.toString();
}
