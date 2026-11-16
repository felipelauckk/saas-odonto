"use client";

import { useState } from "react";

import { SegmentedControl } from "@/components/app/segmented-control";

export function SegmentedDemo() {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  return (
    <SegmentedControl
      label="Visualização"
      value={view}
      onChange={setView}
      options={[
        { value: "day", label: "Dia" },
        { value: "week", label: "Semana" },
        { value: "month", label: "Mês" },
      ]}
    />
  );
}
