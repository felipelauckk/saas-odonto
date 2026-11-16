import { cn } from "cn";

/** Urgência por dias parado: vermelho acima de 20, âmbar acima de 7, cinza abaixo. */
export function pressureTone(days: number) {
  if (days > 20) return "danger" as const;
  if (days > 7) return "warning" as const;
  return "neutral" as const;
}

const COLORS = { danger: "bg-destructive", warning: "bg-warning", neutral: "bg-input" } as const;

/** Traço vertical de 4px à esquerda de um item de fila. Use com o texto de dias ao lado. */
export function PressureBar({ days, className }: { days: number; className?: string }) {
  return <span aria-hidden className={cn("w-1 self-stretch rounded-full", COLORS[pressureTone(days)], className)} />;
}
