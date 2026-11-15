import { describe, expect, it } from "vitest";

import { formatPrescription, renderDocument, type DocumentContext } from "./variables";
import { generateToken, isWellFormedToken, sha256Hex } from "@/lib/hash";

const context: DocumentContext = {
  paciente: { nome: "Ana Souza", cpf: "529.982.247-25", nascimento: "03/05/1990", endereco: "", responsavel: "" },
  clinica: { nome: "Clínica Sorriso", cnpj: "11.222.333/0001-81", endereco: "Rua A, 10", cidade: "São Paulo", telefone: "" },
  profissional: { nome: "Dra. Bia", cro: "CRO-SP 12345" },
  orcamento: { total: "R$ 1.500,00", itens: "- Canal" },
  procedimento: { nome: "Extração de siso" },
  data: { hoje: "16/11/2026", extenso: "16 de novembro de 2026" },
  receita: { itens: "" },
  dias: "2",
  cid: "",
};

describe("renderDocument", () => {
  it("preenche variáveis com e sem grupo", () => {
    expect(renderDocument("{{paciente.nome}} ({{ paciente.cpf }}) — {{dias}} dia(s), {{clinica.cidade}}, {{data.extenso}}", context)).toBe(
      "Ana Souza (529.982.247-25) — 2 dia(s), São Paulo, 16 de novembro de 2026",
    );
  });

  it("variável vazia vira linha para preencher; desconhecida fica visível", () => {
    expect(renderDocument("End.: {{paciente.endereco}} {{paciente.apelido}}", context)).toBe("End.: ________ {{paciente.apelido}}");
  });
});

describe("formatPrescription", () => {
  it("numera e mostra posologia e quantidade", () => {
    expect(
      formatPrescription([
        { name: "Amoxicilina", presentation: "500 mg cápsula", dosage: "1 cápsula de 8/8h por 7 dias.", quantity: "21 cápsulas" },
        { name: "Dipirona", presentation: null, dosage: "Se dor.", quantity: null },
      ]),
    ).toBe("1. Amoxicilina 500 mg cápsula ........ 21 cápsulas\n   1 cápsula de 8/8h por 7 dias.\n\n2. Dipirona\n   Se dor.");
  });
});

describe("hash e token", () => {
  it("token é único e bem formado", () => {
    const a = generateToken();
    expect(isWellFormedToken(a)).toBe(true);
    expect(a).not.toBe(generateToken());
    expect(isWellFormedToken("abc")).toBe(false);
  });

  it("um byte diferente muda o hash", () => {
    const pdf = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);
    const altered = Uint8Array.from(pdf);
    altered[6] = 4;
    expect(sha256Hex(pdf)).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(pdf)).not.toBe(sha256Hex(altered));
  });
});
