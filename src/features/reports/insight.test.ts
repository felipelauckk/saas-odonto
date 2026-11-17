import { describe, expect, it } from "vitest";

import { reportInsight } from "./insight";

const columns = [
  { key: "pro", label: "Profissional", type: "text" as const },
  { key: "n", label: "Recebimentos", type: "int" as const },
  { key: "v", label: "Recebido", type: "money" as const },
];

describe("conclusão escrita dos relatórios", () => {
  it("ordena pelo valor e escreve quem mais pesa", () => {
    const r = reportInsight({
      columns,
      rows: [
        { pro: "Dra. Helena", n: 92, v: 3_172_000 },
        { pro: "Dr. Marcos", n: 38, v: 3_614_000 },
        { pro: "Dr. Paulo", n: 74, v: 2_028_000 },
      ],
    });
    expect(r?.bars.map((b) => b.label)).toEqual(["Dr. Marcos", "Dra. Helena", "Dr. Paulo"]);
    expect(r?.text).toBe("Dr. Marcos responde por 41% do recebido. Dr. Paulo tem a menor fatia (23%).");
  });

  it("com dois grupos, fala dos dois; com muitos, junta o resto", () => {
    expect(reportInsight({ columns, rows: [{ pro: "A", v: 300 }, { pro: "B", v: 100 }] })?.text).toBe(
      "A responde por 75% do recebido. B fica com os outros 25%.",
    );
    const many = reportInsight({ columns, rows: Array.from({ length: 10 }, (_, i) => ({ pro: `P${i}`, v: 100 })) }, 8);
    expect(many?.bars).toHaveLength(8);
    expect(many?.others).toBe(200);
    expect(many?.text).toContain("Os três primeiros somam 30% de 10.");
  });

  it("não se aplica sem texto, sem valor ou com um grupo só", () => {
    expect(reportInsight({ columns, rows: [{ pro: "A", v: 100 }] })).toBeNull();
    expect(reportInsight({ columns: [columns[2]!], rows: [{ v: 1 }, { v: 2 }] })).toBeNull();
    expect(reportInsight({ columns, rows: [{ pro: "A", v: 0 }, { pro: "B", v: 0 }] })).toBeNull();
  });
});
