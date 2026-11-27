import { SETTINGS_AREAS } from "@/features/settings/sections";

/** Função ou configuração que a busca ⌘K encontra (por nome ou sinônimo, sem acento). */
export type SearchShortcut = { label: string; href: string; keywords: string[]; managersOnly?: boolean; frontDeskOnly?: boolean };

/** Sinônimos das telas de Configurações (o título já entra na busca). */
const SETTINGS_KEYWORDS: Record<string, string[]> = {
  "/configuracoes/clinica": ["logo", "cnpj", "endereco da clinica", "papel timbrado"],
  "/configuracoes/membros": ["usuarios", "convidar", "acesso", "permissao", "equipe"],
  "/configuracoes/profissionais": ["dentista", "horario de atendimento", "grade", "cor do profissional", "cro"],
  "/configuracoes/cadeiras": ["consultorio", "sala", "cadeira"],
  "/configuracoes/procedimentos": ["preco", "tabela de precos", "duracao", "tratamento"],
  "/configuracoes/marcadores": ["etiqueta", "tag"],
  "/configuracoes/pacientes": ["origem", "como conheceu", "prontuario", "numero do prontuario", "captacao"],
  "/configuracoes/laboratorios": ["protese", "laboratorio"],
  "/configuracoes/anamnese": ["perguntas", "questionario", "alerta"],
  "/configuracoes/documentos": ["receita", "atestado", "termo", "contrato", "modelo de documento"],
  "/configuracoes/formas-de-pagamento": ["taxa do cartao", "pix", "cartao", "maquininha"],
  "/configuracoes/financeiro": ["categoria", "fornecedor", "centro de custo"],
  "/configuracoes/comissoes": ["comissao", "repasse", "percentual do dentista"],
  "/configuracoes/cobranca": ["asaas", "boleto", "regua de cobranca", "cobranca online", "inadimplencia"],
  "/configuracoes/nota-fiscal": ["nfse", "nfs-e", "iss", "nota", "certificado digital"],
  "/configuracoes/mensagens": ["mensagem de confirmacao", "confirmacao", "lembrete", "aniversario", "whatsapp", "mensagem automatica"],
  "/configuracoes/agendamento-online": ["agendar pelo site", "link de agendamento", "check-in", "pagina publica"],
  "/configuracoes/crm": ["funil", "campanha", "formulario de captacao", "lead"],
  "/configuracoes/assinatura": ["plano", "mensalidade do sistema", "pagamento do sistema"],
  "/configuracoes/auditoria": ["log", "quem acessou", "lgpd"],
};

/** Telas fora do menu principal que valem um atalho. */
const FUNCTIONS: SearchShortcut[] = [
  { label: "Sala de espera", href: "/agenda/sala-de-espera", keywords: ["chegou", "recepcao", "fila"] },
  { label: "Lista de espera", href: "/agenda/espera", keywords: ["encaixe", "vaga", "desistencia"] },
  { label: "Retornos", href: "/agenda/retornos", keywords: ["alerta de retorno", "revisao", "voltar"] },
  { label: "Faltas e desmarcações", href: "/agenda/faltas", keywords: ["faltou", "no-show", "desmarcou"] },
  { label: "Imprimir agenda", href: "/agenda", keywords: ["impressao", "pdf da agenda"] },
  { label: "Caixa do dia", href: "/financeiro/caixa", keywords: ["caixa", "fechamento", "sangria"], frontDeskOnly: true },
  { label: "Contas a pagar", href: "/financeiro/pagar", keywords: ["despesa", "boleto a pagar", "fornecedor"], frontDeskOnly: true },
  { label: "Ajuda", href: "/ajuda", keywords: ["duvida", "suporte", "como fazer", "perguntas frequentes"] },
  { label: "Novidades", href: "/novidades", keywords: ["o que mudou", "atualizacao", "versao"] },
];

export function searchShortcuts({ canManage, isDentist }: { canManage: boolean; isDentist: boolean }): SearchShortcut[] {
  const settings: SearchShortcut[] = canManage
    ? SETTINGS_AREAS.flatMap((a) => a.sections.map((s) => ({ label: s.title, href: s.href, keywords: [s.description, ...(SETTINGS_KEYWORDS[s.href] ?? [])] })))
    : [];
  return [...FUNCTIONS.filter((f) => !(isDentist && f.frontDeskOnly)), ...settings];
}
