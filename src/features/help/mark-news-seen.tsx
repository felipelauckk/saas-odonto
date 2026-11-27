"use client";

import { useEffect } from "react";

import { markNewsSeen } from "./actions";

/** Ao abrir Novidades, marca como vistas (uma vez por visita). */
export function MarkNewsSeen({ latest }: { latest: string }) {
  useEffect(() => {
    void markNewsSeen(latest);
  }, [latest]);
  return null;
}
