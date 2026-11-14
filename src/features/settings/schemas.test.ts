import { describe, expect, it } from "vitest";

import { clinicSchema, paymentMethodSchema, procedureSchema, scheduleSchema, unitSchema } from "./schemas";

const unitId = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const professionalId = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("clinicSchema", () => {
  it("aceita CNPJ/CPF válidos e guarda só os dígitos", () => {
    const result = clinicSchema.parse({ name: "Clínica", document: "11.222.333/0001-81", phone: "", email: "" });
    expect(result.document).toBe("11222333000181");
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
  });

  it("rejeita documento inválido", () => {
    expect(clinicSchema.safeParse({ name: "Clínica", document: "123.456.789-00" }).success).toBe(false);
  });
});

describe("unitSchema", () => {
  it("normaliza CEP e UF", () => {
    const result = unitSchema.parse({ name: "Centro", cep: "01310-100", state: "sp" });
    expect(result.cep).toBe("01310100");
    expect(result.state).toBe("SP");
    expect(result.active).toBe(false);
  });

  it("interpreta o switch", () => {
    expect(unitSchema.parse({ name: "Centro", active: "on" }).active).toBe(true);
  });
});

describe("procedureSchema", () => {
  const base = { name: "Limpeza", durationMin: "45", price: "150,00" };

  it("converte preço para centavos", () => {
    expect(procedureSchema.parse(base).price).toBe(15000);
    expect(procedureSchema.parse({ ...base, price: "1.234,56" }).price).toBe(123456);
    expect(procedureSchema.parse({ ...base, price: "" }).price).toBe(0);
  });

  it("rejeita preço e duração inválidos", () => {
    expect(procedureSchema.safeParse({ ...base, price: "abc" }).success).toBe(false);
    expect(procedureSchema.safeParse({ ...base, durationMin: "0" }).success).toBe(false);
    expect(procedureSchema.safeParse({ ...base, durationMin: "45,5" }).success).toBe(false);
  });
});

describe("paymentMethodSchema", () => {
  it("aceita taxa com vírgula", () => {
    const result = paymentMethodSchema.parse({ name: "Crédito", feePercent: "3,99", daysToReceive: "30" });
    expect(result.feePercent).toBe(3.99);
    expect(result.daysToReceive).toBe(30);
  });

  it("rejeita taxa acima de 100%", () => {
    expect(paymentMethodSchema.safeParse({ name: "X", feePercent: "120", daysToReceive: "0" }).success).toBe(false);
  });
});

describe("scheduleSchema", () => {
  const entry = (weekday: number, start: string, end: string) => ({ unitId, weekday, start, end });

  it("aceita manhã e tarde no mesmo dia", () => {
    const result = scheduleSchema.safeParse({
      professionalId,
      entries: [entry(1, "08:00", "12:00"), entry(1, "13:00", "18:00"), entry(2, "08:00", "12:00")],
    });
    expect(result.success).toBe(true);
  });

  it("aceita períodos encostados", () => {
    const result = scheduleSchema.safeParse({
      professionalId,
      entries: [entry(1, "08:00", "12:00"), entry(1, "12:00", "14:00")],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita sobreposição no mesmo dia", () => {
    const result = scheduleSchema.safeParse({
      professionalId,
      entries: [entry(1, "08:00", "12:00"), entry(1, "11:00", "14:00")],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita fim antes do início", () => {
    expect(scheduleSchema.safeParse({ professionalId, entries: [entry(3, "14:00", "09:00")] }).success).toBe(false);
  });
});
