/** Cálculos da grade da agenda (sem React, testáveis). */

type Interval = { startMin: number; endMin: number };

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;

/**
 * Faixa de horas exibida: cobre o expediente dos profissionais e todas as
 * consultas/bloqueios do período, arredondada para horas cheias.
 */
export function visibleRange(items: Interval[]): { startMin: number; endMin: number } {
  if (!items.length) return { startMin: DEFAULT_START, endMin: DEFAULT_END };
  const start = Math.min(...items.map((i) => i.startMin));
  const end = Math.max(...items.map((i) => i.endMin));
  const startMin = Math.max(0, Math.floor(Math.min(start, DEFAULT_START) / 60) * 60);
  const endMin = Math.min(24 * 60, Math.ceil(Math.max(end, DEFAULT_END) / 60) * 60);
  return { startMin, endMin };
}

/**
 * Coloca itens que se sobrepõem lado a lado. Devolve, para cada id, a faixa
 * (lane) e quantas faixas o grupo de sobreposição usa.
 */
export function computeLanes<T extends Interval & { id: string }>(items: T[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result = new Map<string, { lane: number; lanes: number }>();

  let group: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;

  const flush = () => {
    for (const g of group) result.set(g.id, { lane: g.lane, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.startMin >= groupEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    group.push({ id: item.id, lane });
    groupEnd = Math.max(groupEnd, item.endMin);
  }
  flush();
  return result;
}

/** Arredonda para o múltiplo de `step` mais próximo. */
export function snap(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

/** Minuto do dia a partir de uma posição vertical na grade. */
export function minutesFromOffset(offsetPx: number, hourHeight: number, rangeStart: number, step: number): number {
  return rangeStart + snap((offsetPx / hourHeight) * 60, step);
}
