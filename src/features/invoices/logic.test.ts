import { describe, expect, it } from "vitest";

import { invoiceTaxes, mapAsaasInvoiceStatus } from "./logic";

describe("NFS-e", () => {
  it("traduz status do Asaas", () => {
    expect(mapAsaasInvoiceStatus("SCHEDULED")).toBe("processing");
    expect(mapAsaasInvoiceStatus("SYNCHRONIZED")).toBe("processing");
    expect(mapAsaasInvoiceStatus("AUTHORIZED")).toBe("authorized");
    expect(mapAsaasInvoiceStatus("ERROR")).toBe("error");
    expect(mapAsaasInvoiceStatus("CANCELED", "authorized")).toBe("canceled");
    expect(mapAsaasInvoiceStatus("CANCELLATION_DENIED", "authorized")).toBe("authorized");
    expect(mapAsaasInvoiceStatus("PROCESSING_CANCELLATION", "authorized")).toBe("authorized");
  });

  it("impostos: só ISS", () => {
    expect(invoiceTaxes(2, true)).toEqual({ retainIss: true, iss: 2, cofins: 0, csll: 0, inss: 0, ir: 0, pis: 0 });
  });
});
