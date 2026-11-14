import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeRedirectPath("/agenda")).toBe("/agenda");
    expect(safeRedirectPath("/pacientes?busca=ana")).toBe("/pacientes?busca=ana");
  });

  it("rejeita destinos externos ou inválidos", () => {
    expect(safeRedirectPath("https://malicioso.com")).toBe("/painel");
    expect(safeRedirectPath("//malicioso.com")).toBe("/painel");
    expect(safeRedirectPath("/\\malicioso.com")).toBe("/painel");
    expect(safeRedirectPath("")).toBe("/painel");
    expect(safeRedirectPath(null)).toBe("/painel");
    expect(safeRedirectPath(undefined, "/entrar")).toBe("/entrar");
  });
});
