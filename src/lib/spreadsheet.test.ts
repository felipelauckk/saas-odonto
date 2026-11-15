import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { toCsv, toXlsx } from "./spreadsheet";

/** Lê as entradas de um ZIP pelo diretório central (o suficiente para conferir o .xlsx). */
function unzip(buf: Buffer) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const dataStart = local + 30 + buf.readUInt16LE(local + 26);
    files.set(name, inflateRawSync(buf.subarray(dataStart, dataStart + size)).toString("utf8"));
    p += 46 + nameLen;
  }
  return files;
}

const sheet = { name: "Faturamento", header: ["Profissional", "Valor"], rows: [["Dra. Ana; Silva", 1234.5], ['Dr. "Beto"', null]], moneyColumns: [1] };

describe("toCsv", () => {
  it("usa ponto e vírgula, vírgula decimal, BOM e aspas quando precisa", () => {
    expect(toCsv(sheet)).toBe('﻿Profissional;Valor\r\n"Dra. Ana; Silva";1234,5\r\n"Dr. ""Beto""";\r\n');
  });
});

describe("toXlsx", () => {
  it("gera um zip com planilha, números e dinheiro formatado", () => {
    const files = unzip(toXlsx(sheet));
    expect([...files.keys()]).toContain("xl/worksheets/sheet1.xml");
    const xml = files.get("xl/worksheets/sheet1.xml")!;
    expect(xml).toContain('<c r="B2" s="2"><v>1234.5</v></c>');
    expect(xml).toContain("Dr. &quot;Beto&quot;");
    expect(files.get("xl/workbook.xml")).toContain('name="Faturamento"');
  });
});
