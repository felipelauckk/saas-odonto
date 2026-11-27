export type PatientAddress = {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

/** Endereço numa linha: "Rua X, 10 - ap 2 · Centro · Cidade/UF · CEP 00000-000". */
export function formatAddress(a: PatientAddress | null): string | null {
  if (!a) return null;
  const line1 = [[a.street, a.number].filter(Boolean).join(", "), a.complement].filter(Boolean).join(" - ");
  const line2 = [a.district, [a.city, a.state].filter(Boolean).join("/")].filter(Boolean).join(" · ");
  const cep = a.cep ? `CEP ${a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : null;
  return [line1, line2, cep].filter(Boolean).join(" · ") || null;
}
