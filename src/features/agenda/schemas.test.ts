import { describe, expect, it } from "vitest";

import { agendaParamsSchema, appointmentSchema, blockSchema } from "./schemas";

const ids = {
  patientId: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  professionalId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
};

describe("appointmentSchema", () => {
  it("aceita consulta sem cadeira e converte vazios", () => {
    const result = appointmentSchema.parse({ ...ids, chairId: "", date: "2026-11-16", time: "09:00", durationMin: "30" });
    expect(result.chairId).toBeNull();
    expect(result.procedures).toEqual([]);
    expect(result.confirmationMode).toBe("auto");
    expect(result.reminderMode).toBe("auto");
    expect(result.durationMin).toBe(30);
    expect(result.notes).toBeNull();
  });

  it("exige paciente e horário válido", () => {
    expect(appointmentSchema.safeParse({ ...ids, patientId: "", date: "2026-11-16", time: "09:00", durationMin: 30 }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...ids, date: "2026-11-16", time: "25:00", durationMin: 30 }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...ids, date: "2026-11-16", time: "09:00", durationMin: 0 }).success).toBe(false);
  });

  it("procedimentos com dente e faces válidos", () => {
    const procedureId = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
    const base = { ...ids, date: "2026-11-16", time: "09:00", durationMin: 30 };
    const ok = appointmentSchema.parse({ ...base, procedures: [{ procedureId, tooth: 36, faces: ["O", "M"] }, { procedureId }] });
    expect(ok.procedures).toEqual([
      { procedureId, treatmentItemId: null, tooth: 36, faces: ["O", "M"] },
      { procedureId, treatmentItemId: null, tooth: null, faces: null },
    ]);
    expect(appointmentSchema.safeParse({ ...base, procedures: [{ procedureId, tooth: 19 }] }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...base, procedures: [{ procedureId, faces: ["X"] }] }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...base, confirmationMode: "sempre" }).success).toBe(false);
  });
});

describe("blockSchema", () => {
  it("exige fim depois do início, exceto dia inteiro", () => {
    const base = { professionalId: null, date: "2026-11-16", startTime: "12:00", endTime: "11:00" };
    expect(blockSchema.safeParse({ ...base, allDay: false }).success).toBe(false);
    expect(blockSchema.safeParse({ ...base, allDay: true }).success).toBe(true);
  });
});

describe("agendaParamsSchema", () => {
  it("ignora parâmetros inválidos", () => {
    expect(agendaParamsSchema.parse({ data: "ontem", visao: "mes", por: "x", id: "1" })).toEqual({
      data: undefined,
      visao: "dia",
      por: "profissional",
      id: undefined,
    });
  });
});
