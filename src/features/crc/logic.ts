import type { CrcChannel, CrcOutcome, CrcQueue } from "./labels";

export type CrcItem = {
  queue: CrcQueue;
  itemKey: string;
  patientId: string;
  patientName: string;
  phone: string | null;
  refId: string | null;
  amountCents: number | null;
  refDate: string | null;
};

export type CrcContact = {
  id: string;
  queue: CrcQueue;
  itemKey: string;
  channel: CrcChannel;
  outcome: CrcOutcome | null;
  notes: string | null;
  nextContactOn: string | null;
  createdAt: string;
  authorName: string | null;
};

export type CrcBoardItem = CrcItem & {
  contacts: CrcContact[];
  /** Próximo contato marcado para o futuro: o item fica em "Para depois" até a data. */
  laterOn: string | null;
};

const contactKey = (queue: CrcQueue, itemKey: string) => `${queue}|${itemKey}`;

/**
 * Junta itens e histórico e separa o que é para hoje do que ficou para depois.
 * "Sem interesse" no último contato tira o item da fila; um próximo contato
 * no futuro esconde o item até essa data.
 */
export function buildBoard(items: CrcItem[], contacts: CrcContact[], today: string) {
  const byItem = new Map<string, CrcContact[]>();
  for (const c of [...contacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = contactKey(c.queue, c.itemKey);
    const list = byItem.get(key) ?? [];
    list.push(c);
    byItem.set(key, list);
  }
  const now: CrcBoardItem[] = [];
  const later: CrcBoardItem[] = [];
  for (const item of items) {
    const history = byItem.get(contactKey(item.queue, item.itemKey)) ?? [];
    const last = history[0];
    if (last?.outcome === "not_interested") continue;
    const nextOn = history.find((c) => c.nextContactOn)?.nextContactOn ?? null;
    const laterOn = nextOn && nextOn > today && (!last || last.nextContactOn === nextOn) ? nextOn : null;
    const entry = { ...item, contacts: history, laterOn };
    (laterOn ? later : now).push(entry);
  }
  const order = (a: CrcBoardItem, b: CrcBoardItem) =>
    a.queue === "birthdays" ? (a.refDate ?? "").localeCompare(b.refDate ?? "") : (b.amountCents ?? 0) - (a.amountCents ?? 0) || (a.refDate ?? "").localeCompare(b.refDate ?? "");
  return { now: now.sort(order), later: later.sort((a, b) => (a.laterOn ?? "").localeCompare(b.laterOn ?? "")) };
}

/** Dias desde a data de referência (tempo parado na fila). */
export function daysSince(date: string | null, today: string) {
  if (!date) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}
