/**
 * Contas do painel, sem acesso ao banco (testáveis isoladamente).
 * Datas em "YYYY-MM-DD" no fuso America/Sao_Paulo; dinheiro em centavos.
 */

/** "Bom dia" até 11h59, "Boa tarde" até 17h59, depois "Boa noite". */
export function greeting(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Último dia do mês de uma data (28 a 31). */
export function daysInMonth(date: string): number {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Dias úteis (segunda a sábado) do mês, do dia `from` ao dia `to`, inclusive. */
export function businessDays(month: string, from: number, to: number): number {
  let n = 0;
  for (let d = from; d <= to; d++) {
    if (weekday(`${month}-${String(d).padStart(2, "0")}`) !== 0) n++;
  }
  return n;
}

export type RevenuePace = {
  /** Recebido acumulado ao fim de cada dia, do dia 1 até hoje. */
  accumulated: number[];
  total: number;
  lastDay: number;
  today: number;
  /** Média por dia útil até hoje × dias úteis do mês. Nulo antes do primeiro dia útil. */
  projection: number | null;
  goal: number | null;
  /** Quanto a meta "pede" até hoje (proporcional aos dias úteis). */
  paceToday: number | null;
  /** Recebido ÷ ritmo da meta − 1 (0,1 = 10% acima). */
  paceDelta: number | null;
  /** Quanto falta por dia útil restante (depois de hoje) para bater a meta. */
  requiredPerDay: number | null;
  /** Dia com maior recebimento (nulo se nada foi recebido). */
  bestDay: number | null;
};

/**
 * Ritmo do faturamento no mês. `daily[i]` é o recebido no dia i+1; `today` é a
 * data de hoje (o mês é tirado dela).
 */
export function revenuePace(daily: number[], today: string, goal: number | null): RevenuePace {
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const lastDay = daysInMonth(today);
  const accumulated: number[] = [];
  let total = 0;
  let bestDay: number | null = null;
  let best = 0;
  for (let d = 1; d <= day; d++) {
    const v = daily[d - 1] ?? 0;
    total += v;
    accumulated.push(total);
    if (v > best) {
      best = v;
      bestDay = d;
    }
  }
  const elapsed = businessDays(month, 1, day);
  const all = businessDays(month, 1, lastDay);
  const remaining = businessDays(month, day + 1, lastDay);
  const projection = elapsed > 0 ? Math.round((total / elapsed) * all) : null;
  const hasGoal = goal !== null && goal > 0;
  const paceToday = hasGoal && all > 0 ? (goal * elapsed) / all : null;
  const paceDelta = paceToday ? total / paceToday - 1 : null;
  const requiredPerDay = hasGoal && remaining > 0 ? Math.max(0, Math.round((goal - total) / remaining)) : null;
  return { accumulated, total, lastDay, today: day, projection, goal: hasGoal ? goal : null, paceToday, paceDelta, requiredPerDay, bestDay };
}

/** Variação relativa (0,12 = +12%); nula quando a base é zero. */
export function relativeChange(current: number, previous: number): number | null {
  return previous > 0 ? current / previous - 1 : null;
}

export type FunnelStep = { label: string; value: number };

/** Etapas do funil com a taxa de passagem da anterior. */
export function funnelRates(steps: FunnelStep[]) {
  return steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1]!.value : null;
    return { ...s, rate: prev ? s.value / prev : null, share: steps[0]?.value ? s.value / steps[0].value : 0 };
  });
}

/** Passagem com mais gente perdida (em número). Nula se ninguém se perdeu. */
export function biggestLoss(steps: FunnelStep[]): { from: string; to: string; lost: number } | null {
  let result: { from: string; to: string; lost: number } | null = null;
  for (let i = 1; i < steps.length; i++) {
    const lost = steps[i - 1]!.value - steps[i]!.value;
    if (lost > 0 && (!result || lost > result.lost)) result = { from: steps[i - 1]!.label, to: steps[i]!.label, lost };
  }
  return result;
}

/** Dias parados a partir dos quais um orçamento em aberto conta como "parado". */
export const STALLED_QUOTE_DAYS = 20;
/** Taxa de faltas (30 dias) a partir da qual o resumo do dia avisa. */
export const NO_SHOW_ALERT_RATE = 0.1;

export type DaySummaryInput = {
  paceDelta: number | null;
  unconfirmedTomorrow: number;
  stalledQuotes: number | null;
  noShowRate: number;
  pastAppointments: number;
};

export type DaySummary = {
  /** Frase do ritmo da meta, com o trecho em destaque separado. */
  pace: { before: string; strong: string } | null;
  /** Pendências do dia, já escritas. */
  todos: string[];
};

const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Resumo do dia em linguagem natural. Só entra o que tem dado. */
export function daySummary(input: DaySummaryInput): DaySummary {
  let pace: DaySummary["pace"] = null;
  if (input.paceDelta !== null) {
    const rounded = Math.round(input.paceDelta * 100);
    pace =
      rounded === 0
        ? { before: "O mês está ", strong: "no ritmo da meta" }
        : { before: "O mês está ", strong: `${pct.format(Math.abs(input.paceDelta))} ${rounded > 0 ? "acima" : "abaixo"} do ritmo da meta` };
  }
  const todos: string[] = [];
  if (input.unconfirmedTomorrow > 0) {
    todos.push(`${plural(input.unconfirmedTomorrow, "consulta de amanhã ainda sem confirmação", "consultas de amanhã ainda sem confirmação")}`);
  }
  if (input.stalledQuotes) {
    todos.push(`${plural(input.stalledQuotes, "orçamento parado", "orçamentos parados")} há mais de ${STALLED_QUOTE_DAYS} dias`);
  }
  if (input.pastAppointments >= 10 && input.noShowRate >= NO_SHOW_ALERT_RATE) {
    todos.push(`taxa de faltas de ${pct.format(input.noShowRate)} nos últimos 30 dias`);
  }
  return { pace, todos };
}

/** Junta itens em português: "a", "a e b", "a, b e c". */
export function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Escala "redonda" para o eixo y: 4 intervalos iguais cobrindo `max` (mínimo 4 × 1). */
export function niceTicks(max: number, count = 4): number[] {
  const raw = Math.max(max / count, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= raw)!;
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}
