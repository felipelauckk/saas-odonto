import { describe, expect, it } from "vitest";

import { searchShortcuts } from "@/components/layout/search-entries";

import { getNews, parseNews } from "./content";

describe("novidades e busca de funções", () => {
  it("lê data, versão e título do cabeçalho", () => {
    expect(parseNews("x", "---\ndata: 2026-11-29\nversao: 3.0\ntitulo: Teste: com dois-pontos\n---\n\n- item")).toEqual({
      slug: "x",
      date: "2026-11-29",
      version: "3.0",
      title: "Teste: com dois-pontos",
      body: "- item",
    });
    expect(parseNews("x", "sem cabeçalho")).toBeNull();
  });

  it("as novidades do repositório são válidas e vêm da mais nova para a mais antiga", async () => {
    const news = await getNews();
    expect(news.length).toBeGreaterThan(0);
    expect([...news].sort((a, b) => b.date.localeCompare(a.date))).toEqual(news);
  });

  it("acha configurações por sinônimo sem acento, só para a gestão", () => {
    const hit = (term: string, access = { canManage: true, isDentist: false }) =>
      searchShortcuts(access).filter((s) => [s.label, ...s.keywords].some((k) => k.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(term)));
    expect(hit("mensagem de confirmacao").map((s) => s.href)).toContain("/configuracoes/mensagens");
    expect(hit("nota fiscal").map((s) => s.href)).toContain("/configuracoes/nota-fiscal");
    expect(hit("comissao").map((s) => s.href)).toContain("/configuracoes/comissoes");
    expect(hit("cadeiras").map((s) => s.href)).toContain("/configuracoes/cadeiras");
    expect(hit("comissao", { canManage: false, isDentist: false })).toEqual([]);
    expect(hit("caixa", { canManage: false, isDentist: true })).toEqual([]);
  });
});
