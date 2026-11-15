import { describe, expect, it } from "vitest";

import { parseOfx, parseOfxAmount, suggestMatches } from "./ofx";
import { bucketOf, buildDre, cashFlow } from "./reports";

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0341<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20301105120000[-3:BRT]<TRNAMT>250.00<FITID>A1<MEMO>PIX RECEBIDO ANA</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20301106<TRNAMT>-1.500,00<FITID>A2<NAME>ALUGUEL<MEMO>BOLETO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>xx<TRNAMT>-1<FITID>RUIM</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("OFX", () => {
  it("lê conta e lançamentos, ignorando linhas inválidas", () => {
    const { accountLabel, transactions } = parseOfx(OFX);
    expect(accountLabel).toBe("0341 / 12345-6");
    expect(transactions).toEqual([
      { fitid: "A1", postedOn: "2030-11-05", amountCents: 25000, description: "PIX RECEBIDO ANA" },
      { fitid: "A2", postedOn: "2030-11-06", amountCents: -150000, description: "ALUGUEL · BOLETO" },
    ]);
  });

  it("converte valores nos dois formatos", () => {
    expect(parseOfxAmount("-123.45")).toBe(-12345);
    expect(parseOfxAmount("1.234,56")).toBe(123456);
    expect(parseOfxAmount("abc")).toBeNull();
  });

  it("sugere pares pelo valor e data mais próxima, sem repetir", () => {
    const matches = suggestMatches(
      [
        { id: "b1", amountCents: 25000, postedOn: "2030-11-05" },
        { id: "b2", amountCents: 25000, postedOn: "2030-11-06" },
        { id: "b3", amountCents: -150000, postedOn: "2030-11-06" },
        { id: "b4", amountCents: 999, postedOn: "2030-11-06" },
      ],
      [
        { id: "r1", kind: "receivable", amountCents: 25000, date: "2030-11-04", label: "Ana" },
        { id: "r2", kind: "receivable", amountCents: 25000, date: "2030-11-06", label: "Bia" },
        { id: "p1", kind: "payable", amountCents: 150000, date: "2030-11-05", label: "Aluguel" },
        { id: "r3", kind: "receivable", amountCents: 25000, date: "2030-11-20", label: "Longe" },
      ],
    );
    expect(matches.get("b1")?.id).toBe("r1");
    expect(matches.get("b2")?.id).toBe("r2");
    expect(matches.get("b3")?.id).toBe("p1");
    expect(matches.has("b4")).toBe(false);
  });
});

describe("fluxo de caixa e DRE", () => {
  it("agrupa por semana (segunda) e mês", () => {
    expect(bucketOf("2030-11-10", "week")).toBe("2030-11-04"); // domingo → segunda anterior
    expect(bucketOf("2030-11-04", "week")).toBe("2030-11-04");
    expect(bucketOf("2030-11-30", "month")).toBe("2030-11-01");
  });

  it("separa realizado e previsto com saldo acumulado", () => {
    const rows = cashFlow(
      {
        movements: [
          { date: "2030-11-01", type: "in", amountCents: 10000 },
          { date: "2030-11-01", type: "out", amountCents: 3000 },
        ],
        receivables: [{ dueDate: "2030-12-10", amountCents: 5000 }],
        payables: [{ dueDate: "2030-12-15", amountCents: 2000 }],
      },
      "month",
    );
    expect(rows).toEqual([
      { bucket: "2030-11-01", realizedIn: 10000, realizedOut: 3000, expectedIn: 0, expectedOut: 0, balance: 7000 },
      { bucket: "2030-12-01", realizedIn: 0, realizedOut: 0, expectedIn: 5000, expectedOut: 2000, balance: 10000 },
    ]);
  });

  it("DRE: bruto − taxas − despesas", () => {
    expect(
      buildDre({
        revenue: [
          { amountCents: 100000, feeCents: 3000 },
          { amountCents: 50000, feeCents: 0 },
        ],
        expenses: [
          { category: "Aluguel", amountCents: 40000 },
          { category: "Material", amountCents: 10000 },
          { category: "Material", amountCents: 5000 },
        ],
      }),
    ).toEqual({
      grossRevenue: 150000,
      fees: 3000,
      netRevenue: 147000,
      expenses: [
        { category: "Aluguel", amountCents: 40000 },
        { category: "Material", amountCents: 15000 },
      ],
      totalExpenses: 55000,
      result: 92000,
    });
  });
});
