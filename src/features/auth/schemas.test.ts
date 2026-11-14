import { describe, expect, it } from "vitest";

import { newPasswordSchema, signInSchema, signUpSchema } from "./schemas";

const valid = {
  clinicName: "Clínica Sorriso",
  fullName: "Ana Souza",
  email: "  Ana@Exemplo.com ",
  whatsapp: "(11) 98888-7777",
  password: "senhaforte1",
};

describe("signUpSchema", () => {
  it("aceita um cadastro válido e normaliza e-mail e WhatsApp", () => {
    const result = signUpSchema.parse(valid);
    expect(result.email).toBe("ana@exemplo.com");
    expect(result.whatsapp).toBe("11988887777");
  });

  it("aceita telefone fixo com DDD", () => {
    expect(signUpSchema.safeParse({ ...valid, whatsapp: "(11) 3333-4444" }).success).toBe(true);
  });

  it("rejeita WhatsApp sem DDD", () => {
    const result = signUpSchema.safeParse({ ...valid, whatsapp: "98888-7777" });
    expect(result.success).toBe(false);
  });

  it("exige senha forte", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "curta1" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "somenteletras" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "12345678" }).success).toBe(false);
  });

  it("exige o nome da clínica", () => {
    const result = signUpSchema.safeParse({ ...valid, clinicName: "  " });
    expect(result.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("rejeita e-mail inválido", () => {
    expect(signInSchema.safeParse({ email: "ana", password: "x" }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("exige confirmação igual", () => {
    const result = newPasswordSchema.safeParse({ password: "senhaforte1", confirmPassword: "outra1234" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});
