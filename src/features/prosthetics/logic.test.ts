import { describe, expect, it } from "vitest";

import { alignerStatus, isLabLate, waitingLab, type OrderTiming } from "./logic";

const base: OrderTiming = { kind: "prosthesis", stage: "sent", expectedReturnOn: "2026-11-10", alignerTotal: null, alignerChangeDays: null, alignersDelivered: 0, alignerStartedOn: null };

describe("próteses: prazos", () => {
  it("atraso do laboratório só quando está no laboratório", () => {
    expect(isLabLate(base, "2026-11-15")).toBe(true);
    expect(isLabLate(base, "2026-11-10")).toBe(false);
    expect(isLabLate({ ...base, stage: "try_in" }, "2026-11-15")).toBe(false);
    expect(waitingLab(base)).toBe(true);
    expect(waitingLab({ ...base, stage: "ready" })).toBe(false);
  });

  it("alinhadores: até quando duram as placas e quando avisar", () => {
    const aligner: OrderTiming = { ...base, kind: "aligner", stage: "delivered", alignerTotal: 20, alignerChangeDays: 14, alignersDelivered: 4, alignerStartedOn: "2026-10-01" };
    const s = alignerStatus(aligner, "2026-11-15")!;
    expect(s.runsOutOn).toBe("2026-11-26"); // 4 placas × 14 dias
    expect(s.needsDelivery).toBe(true);
    expect(s.currentAligner).toBe(4);
    expect(alignerStatus({ ...aligner, alignersDelivered: 8 }, "2026-11-15")!.needsDelivery).toBe(false);
    expect(alignerStatus({ ...aligner, alignersDelivered: 20 }, "2027-06-01")!.finished).toBe(true);
    expect(alignerStatus(base, "2026-11-15")).toBeNull();
  });
});
