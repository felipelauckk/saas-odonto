/**
 * Variáveis dos modelos de documento: {{grupo.campo}} ou {{campo}}.
 * Variável sem valor fica em branco ("____") para preencher à mão, nunca some calada.
 */

export type PrescriptionItem = { name: string; presentation: string | null; dosage: string; quantity: string | null };

export type DocumentContext = {
  paciente: { nome: string; cpf: string; nascimento: string; endereco: string; responsavel: string };
  clinica: { nome: string; cnpj: string; endereco: string; cidade: string; telefone: string };
  profissional: { nome: string; cro: string };
  orcamento: { total: string; itens: string };
  procedimento: { nome: string };
  data: { hoje: string; extenso: string };
  receita: { itens: string };
  dias: string;
  cid: string;
};

export const VARIABLES: { key: string; label: string }[] = [
  { key: "paciente.nome", label: "Nome do paciente" },
  { key: "paciente.cpf", label: "CPF do paciente" },
  { key: "paciente.nascimento", label: "Data de nascimento" },
  { key: "paciente.endereco", label: "Endereço do paciente" },
  { key: "paciente.responsavel", label: "Responsável legal" },
  { key: "clinica.nome", label: "Nome da clínica" },
  { key: "clinica.cnpj", label: "CNPJ/CPF da clínica" },
  { key: "clinica.endereco", label: "Endereço da clínica" },
  { key: "clinica.cidade", label: "Cidade da clínica" },
  { key: "clinica.telefone", label: "Telefone da clínica" },
  { key: "profissional.nome", label: "Profissional" },
  { key: "profissional.cro", label: "CRO do profissional" },
  { key: "orcamento.total", label: "Total do orçamento" },
  { key: "orcamento.itens", label: "Itens do orçamento" },
  { key: "procedimento.nome", label: "Procedimento" },
  { key: "data.hoje", label: "Data de hoje" },
  { key: "data.extenso", label: "Data por extenso" },
  { key: "receita.itens", label: "Medicamentos da receita" },
  { key: "dias", label: "Dias de afastamento" },
  { key: "cid", label: "CID (opcional)" },
];

const BLANK = "________";

export function renderDocument(body: string, context: DocumentContext): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path: string) => {
    const value = path.split(".").reduce<unknown>((obj, key) => (obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined), context);
    if (typeof value === "string") return value.trim() ? value : BLANK;
    return match; // variável desconhecida fica visível para a clínica corrigir o modelo
  });
}

/** Lista numerada de medicamentos, como no receituário em papel. */
export function formatPrescription(items: PrescriptionItem[]): string {
  return items
    .map((item, i) => {
      const head = [item.name, item.presentation].filter(Boolean).join(" ");
      const qty = item.quantity ? ` ........ ${item.quantity}` : "";
      return `${i + 1}. ${head}${qty}\n   ${item.dosage}`;
    })
    .join("\n\n");
}

const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

export function dateVariables(now: Date = new Date()) {
  return { hoje: shortDate.format(now), extenso: longDate.format(now) };
}
