import { describe, expect, it } from "vitest";

import { patientFiltersSchema, patientSchema } from "./schemas";

const base = { fullName: "Ana Souza" };

describe("patientSchema", () => {
  it("aceita só o nome e transforma vazios em null", () => {
    const result = patientSchema.parse({ ...base, cpf: "", phone: "", email: "", sourceId: "" });
    expect(result).toMatchObject({ fullName: "Ana Souza", cpf: null, phone: null, email: null, sourceId: null, otherPhones: [], preferredContact: "patient" });
    expect(result).not.toHaveProperty("requireEmail");
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

  it("menor de idade exige nome, CPF e telefone do responsável", () => {
    const minor = { ...base, birthDate: "2020-01-01" };
    const result = patientSchema.safeParse(minor);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(["guardianName", "guardianCpf", "guardianPhone"]);

    expect(patientSchema.safeParse({ ...minor, guardianName: "Carla Souza", guardianCpf: "529.982.247-25", guardianPhone: "(11) 97777-6666" }).success).toBe(true);
  });

  it("falar com o responsável exige o telefone dele", () => {
    const r = patientSchema.safeParse({ ...base, preferredContact: "guardian" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["guardianPhone"]);
  });

  it("e-mail obrigatório só se a clínica exigir e o paciente não marcar \"não tem e-mail\"", () => {
    expect(patientSchema.safeParse({ ...base }).success).toBe(true);
    expect(patientSchema.safeParse({ ...base, requireEmail: true }).success).toBe(false);
    expect(patientSchema.safeParse({ ...base, requireEmail: true, noEmail: "on" }).success).toBe(true);
    // "Não tem e-mail" apaga um e-mail esquecido no campo.
    expect(patientSchema.parse({ ...base, email: "a@b.com", noEmail: "on" }).email).toBeNull();
  });

  it("outros telefones, redes sociais e país do celular", () => {
    const r = patientSchema.parse({
      ...base,
      otherPhones: JSON.stringify([{ label: "Trabalho", number: "(11) 3333-4444" }]),
      instagram: "@ana.souza",
      facebook: "https://facebook.com/ana.souza/",
      phoneCountry: "",
    });
    expect(r.otherPhones).toEqual([{ label: "Trabalho", number: "1133334444" }]);
    expect(r.instagram).toBe("ana.souza");
    expect(r.facebook).toBe("ana.souza");
    expect(r.phoneCountry).toBe("55");
    expect(patientSchema.safeParse({ ...base, otherPhones: JSON.stringify([{ number: "123" }]) }).success).toBe(false);
    expect(patientSchema.safeParse({ ...base, instagram: "nome com espaço" }).success).toBe(false);
  });

  it("indicação só no formato paciente: ou parceiro:", () => {
    expect(patientSchema.safeParse({ ...base, referral: "patient:6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b" }).success).toBe(true);
    expect(patientSchema.safeParse({ ...base, referral: "qualquer" }).success).toBe(false);
  });

  it("não exige responsável para adulto", () => {
    expect(patientSchema.safeParse({ ...base, birthDate: "1990-01-01" }).success).toBe(true);
  });
});

describe("patientFiltersSchema", () => {
  it("usa padrões seguros para valores estranhos", () => {
    expect(patientFiltersSchema.parse({ q: "ana", status: "x", sourceId: "tiktok", segment: "vip", page: "-3" })).toEqual({
      q: "ana",
      status: "active",
      sourceId: null,
      segment: null,
      page: 1,
    });
  });
});
