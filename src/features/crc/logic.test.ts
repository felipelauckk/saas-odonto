import { describe, expect, it } from "vitest";

import { buildBoard, daysSince, type CrcContact, type CrcItem } from "./logic";

const item = (key: string, amount: number | null = null): CrcItem => ({
  queue: "open_quotes",
  itemKey: key,
  patientId: "p",
  patientName: "Ana",
  phone: null,
  refId: null,
  amountCents: amount,
  refDate: "2026-11-01",
});
const contact = (key: string, at: string, extra: Partial<CrcContact> = {}): CrcContact => ({
  id: at,
  queue: "open_quotes",
  itemKey: key,
  channel: "call",
  outcome: null,
  notes: null,
  nextContactOn: null,
  createdAt: at,
  authorName: null,
  ...extra,
});

describe("buildBoard", () => {
  it("ordena por valor e anexa o histórico do mais recente ao mais antigo", () => {
    const { now } = buildBoard([item("a", 100), item("b", 500)], [contact("a", "2026-11-02"), contact("a", "2026-11-03")], "2026-11-14");
    expect(now.map((i) => i.itemKey)).toEqual(["b", "a"]);
    expect(now[1]!.contacts.map((c) => c.createdAt)).toEqual(["2026-11-03", "2026-11-02"]);
  });

  it("sem interesse sai da fila; próximo contato futuro vai para depois", () => {
    const { now, later } = buildBoard(
      [item("a"), item("b"), item("c")],
      [
        contact("a", "2026-11-10", { outcome: "not_interested" }),
        contact("b", "2026-11-10", { outcome: "thinking", nextContactOn: "2026-11-20" }),
        contact("c", "2026-11-01", { outcome: "thinking", nextContactOn: "2026-11-12" }),
      ],
      "2026-11-14",
    );
    expect(now.map((i) => i.itemKey)).toEqual(["c"]);
    expect(later.map((i) => [i.itemKey, i.laterOn])).toEqual([["b", "2026-11-20"]]);
  });

  it("um contato novo sem data tira o item de 'para depois'", () => {
    const { now } = buildBoard(
      [item("a")],
      [contact("a", "2026-11-10", { nextContactOn: "2026-11-20" }), contact("a", "2026-11-11", { outcome: "no_answer" })],
      "2026-11-14",
    );
    expect(now).toHaveLength(1);
  });

  it("conta dias parados", () => {
    expect(daysSince("2026-11-01", "2026-11-14")).toBe(13);
    expect(daysSince(null, "2026-11-14")).toBeNull();
  });
});
