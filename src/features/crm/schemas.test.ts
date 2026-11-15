import { describe, expect, it } from "vitest";

import { leadSchema, referralColumns } from "./schemas";

describe("leadSchema", () => {
  const base = { name: "Ana", source: "instagram" };
  it("exige telefone ou e-mail e normaliza o telefone", () => {
    expect(leadSchema.safeParse(base).success).toBe(false);
    expect(leadSchema.parse({ ...base, phone: "(11) 98888-7777" }).phone).toBe("11988887777");
    expect(leadSchema.parse({ ...base, email: "ana@example.com" }).phone).toBeNull();
    expect(leadSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
  });
  it("campanha 'none' vira nula", () => {
    expect(leadSchema.parse({ ...base, phone: "11988887777", campaignId: "none" }).campaignId).toBeNull();
  });
});

describe("referralColumns", () => {
  it("separa paciente e parceiro", () => {
    expect(referralColumns("patient:abc")).toEqual({ referred_by_patient_id: "abc", referred_by_partner_id: null });
    expect(referralColumns("partner:xyz")).toEqual({ referred_by_patient_id: null, referred_by_partner_id: "xyz" });
    expect(referralColumns("")).toEqual({ referred_by_patient_id: null, referred_by_partner_id: null });
  });
});
