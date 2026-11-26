import { describe, expect, it } from "vitest";

import { commitmentDates, pickRange } from "./commitments";

describe("compromissos: datas da série", () => {
  it("não se repete: só a data", () => {
    expect(commitmentDates("2030-03-04", "none", { count: 10 })).toEqual(["2030-03-04"]);
  });

  it("dia útil por 4 semanas dá 20 ocorrências, sem sábado e domingo", () => {
    const dates = commitmentDates("2030-03-04", "weekdays", { until: "2030-03-29" });
    expect(dates).toHaveLength(20);
    expect(dates[0]).toBe("2030-03-04");
    expect(dates.at(-1)).toBe("2030-03-29");
    expect(dates).not.toContain("2030-03-09");
    expect(dates).not.toContain("2030-03-10");
  });

  it("dia útil começando no sábado começa na segunda", () => {
    expect(commitmentDates("2030-03-09", "weekdays", { count: 2 })).toEqual(["2030-03-11", "2030-03-12"]);
  });

  it("semanal, a cada 2 semanas e mensal, por quantidade ou até uma data", () => {
    expect(commitmentDates("2030-03-04", "week", { count: 3 })).toEqual(["2030-03-04", "2030-03-11", "2030-03-18"]);
    expect(commitmentDates("2030-03-04", "2weeks", { until: "2030-04-01" })).toEqual(["2030-03-04", "2030-03-18", "2030-04-01"]);
    expect(commitmentDates("2030-01-31", "month", { count: 3 })).toEqual(["2030-01-31", "2030-02-28", "2030-03-31"]);
  });

  it("nunca passa de 52", () => {
    expect(commitmentDates("2030-01-01", "week", { count: 500 })).toHaveLength(52);
    expect(commitmentDates("2030-01-01", "weekdays", { until: "2031-12-31" })).toHaveLength(52);
  });
});

describe("compromissos: faixa de horário em dois cliques", () => {
  it("primeiro clique é o início; o segundo fecha incluindo o botão", () => {
    const a = pickRange({ startMin: null, endMin: null }, 720);
    expect(a).toEqual({ startMin: 720, endMin: null });
    expect(pickRange(a, 765)).toEqual({ startMin: 720, endMin: 780 });
    // Mesmo botão duas vezes: 15 minutos.
    expect(pickRange(a, 720)).toEqual({ startMin: 720, endMin: 735 });
  });

  it("clicar antes do início ou com a faixa pronta recomeça", () => {
    expect(pickRange({ startMin: 720, endMin: null }, 600)).toEqual({ startMin: 600, endMin: null });
    expect(pickRange({ startMin: 720, endMin: 780 }, 900)).toEqual({ startMin: 900, endMin: null });
  });
});
