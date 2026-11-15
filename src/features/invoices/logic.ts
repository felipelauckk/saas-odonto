export type InvoiceStatus = "processing" | "authorized" | "canceled" | "error";

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  processing: "Em emissão",
  authorized: "Emitida",
  canceled: "Cancelada",
  error: "Erro",
};

/** Status do Asaas → nosso status. Cancelamento negado mantém a nota emitida. */
export function mapAsaasInvoiceStatus(status: string, current: InvoiceStatus = "processing"): InvoiceStatus {
  switch (status) {
    case "AUTHORIZED":
      return "authorized";
    case "CANCELED":
      return "canceled";
    case "ERROR":
      return "error";
    case "CANCELLATION_DENIED":
      return current === "canceled" ? "canceled" : "authorized";
    case "PROCESSING_CANCELLATION":
      return current;
    default:
      return "processing"; // SCHEDULED, SYNCHRONIZED
  }
}

/** Impostos da nota: só o ISS (com ou sem retenção); demais tributos zerados para clínica de serviço comum. */
export function invoiceTaxes(issRate: number, retainIss: boolean) {
  return { retainIss, iss: issRate, cofins: 0, csll: 0, inss: 0, ir: 0, pis: 0 };
}
