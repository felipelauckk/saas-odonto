import { describe, expect, it } from "vitest";

import { patientSituation, segmentFromSlug } from "./situation";

const base = { overdueCents: 0, returnOverdue: false, inTreatment: false, openQuote: false, lastVisitAt: null, nextVisitAt: null };

describe("situação do paciente na lista", () => {
  it("mostra primeiro o que pede ação", () => {
    expect(patientSituation({ ...base, overdueCents: 100, returnOverdue: true, inTreatment: true }).label).toBe("Parcela vencida");
    expect(patientSituation({ ...base, returnOverdue: true, inTreatment: true }).label).toBe("Retorno vencido");
    expect(patientSituation({ ...base, inTreatment: true, openQuote: true }).label).toBe("Em tratamento");
    expect(patientSituation({ ...base, openQuote: true }).label).toBe("Orçamento em aberto");
  });

  it("separa quem nunca veio de quem já veio", () => {
    expect(patientSituation({ ...base, nextVisitAt: "2026-11-20T13:00:00Z" })).toEqual({ label: "Primeira consulta", tone: "neutral" });
    expect(patientSituation({ ...base, lastVisitAt: "2026-11-02T13:00:00Z" })).toEqual({ label: "Em dia", tone: "success" });
    expect(patientSituation(base).label).toBe("Sem visitas");
  });

  it("lê o filtro da URL", () => {
    expect(segmentFromSlug("retorno-vencido")).toBe("return_overdue");
    expect(segmentFromSlug("qualquer")).toBeNull();
  });
});
