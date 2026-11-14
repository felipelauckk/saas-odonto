import { describe, expect, it } from "vitest";

import { inviteMemberSchema } from "./schemas";

describe("inviteMemberSchema", () => {
  it("aceita um convite válido", () => {
    const result = inviteMemberSchema.parse({ fullName: "Bruno Lima", email: " Bruno@Clinica.com", role: "dentist" });
    expect(result.email).toBe("bruno@clinica.com");
  });

  it("rejeita papel desconhecido", () => {
    const result = inviteMemberSchema.safeParse({ fullName: "Bruno", email: "b@c.com", role: "superadmin" });
    expect(result.success).toBe(false);
  });
});
