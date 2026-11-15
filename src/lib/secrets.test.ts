import { afterEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret, isSecretsConfigured } from "./secrets";

describe("segredos das clínicas", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("criptografa e abre; cada vez sai diferente; alteração é detectada", () => {
    vi.stubEnv("CLINIC_SECRETS_KEY", Buffer.alloc(32, 7).toString("base64"));
    const a = encryptSecret("$aact_chave_secreta");
    const b = encryptSecret("$aact_chave_secreta");
    expect(a).not.toBe(b);
    expect(a).not.toContain("chave");
    expect(decryptSecret(a)).toBe("$aact_chave_secreta");
    const parts = a.split(".");
    const tampered = [...parts.slice(0, 3), `${parts[3]!.slice(0, -2)}AA`].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("sem chave configurada não funciona", () => {
    vi.stubEnv("CLINIC_SECRETS_KEY", "");
    expect(isSecretsConfigured()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(/CLINIC_SECRETS_KEY/);
  });
});
