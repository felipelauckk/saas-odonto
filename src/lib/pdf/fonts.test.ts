import { createElement as h } from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { registerPdfFonts } from "./fonts";

describe("fontes dos PDFs", () => {
  it("gera PDF com a Montserrat embutida, inclusive acentos", async () => {
    registerPdfFonts();
    const doc = h(Document, null, h(Page, { size: "A4" }, [
      h(Text, { key: "a", style: { fontFamily: "Montserrat" } }, "Orçamento de restauração"),
      h(Text, { key: "b", style: { fontFamily: "Montserrat-Black" } }, "Clínica Sorriso"),
    ]));
    const pdf = await renderToBuffer(doc);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const text = pdf.toString("latin1");
    expect(text).toMatch(/Montserrat-Regular/);
    expect(text).toMatch(/Montserrat-Black/);
  }, 30_000);
});
