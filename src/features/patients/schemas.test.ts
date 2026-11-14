import { describe, expect, it } from "vitest";

import { patientFiltersSchema, patientSchema } from "./schemas";

const base = { fullName: "Ana Souza" };

describe("patientSchema", () => {
  it("aceita só o nome e transforma vazios em null", () => {
    const result = patientSchema.parse({ ...base, cpf: "", phone: "", email: "", source: "" });
    expect(result).toMatchObject({ fullName: "Ana Souza", cpf: null, phone: null, email: null, source: null });
  });

  it("normaliza CPF, telefone e CEP para dígitos", () => {
    const result = patientSchema.parse({ ...base, cpf: "529.982.247-25", phone: "(11) 98888-7777", cep: "01310-100" });
    expect(result.cpf).toBe("52998224725");
    expect(result.phone).toBe("11988887777");
    expect(result.cep).toBe("01310100");
  });

  it("rejeita CPF inválido", () => {
    expect(patientSchema.safeParse({ ...base, cpf: "123.456.789-00" }).success).toBe(false);
  });

  it("copia o telefone para o WhatsApp quando marcado", () => {
    const result = patientSchema.parse({ ...base, phone: "11988887777", whatsappSameAsPhone: "on", whatsapp: "" });
    expect(result.whatsapp).toBe("11988887777");
  });

  it("rejeita nascimento no futuro", () => {
    expect(patientSchema.safeParse({ ...base, birthDate: "2999-01-01" }).success).toBe(false);
  });

  it("exige responsável para menor de idade", () => {
    const minor = { ...base, birthDate: "2020-01-01" };
    const result = patientSchema.safeParse(minor);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["guardianName"]);

    expect(patientSchema.safeParse({ ...minor, guardianName: "Carla Souza" }).success).toBe(true);
  });

  it("não exige responsável para adulto", () => {
    expect(patientSchema.safeParse({ ...base, birthDate: "1990-01-01" }).success).toBe(true);
  });
});

describe("patientFiltersSchema", () => {
  it("usa padrões seguros para valores estranhos", () => {
    expect(patientFiltersSchema.parse({ q: "ana", status: "x", source: "tiktok", page: "-3" })).toEqual({
      q: "ana",
      status: "active",
      source: null,
      page: 1,
    });
  });
});
