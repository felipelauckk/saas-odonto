import { cn } from "cn";

import { BRAND, BRAND_MARK } from "@/lib/brand";

/** Símbolo Arcada. "dark": fundo petróleo profundo (fundos claros); "light": fundo branco (menu escuro). */
export function BrandMark({ variant = "dark", className, title }: { variant?: "dark" | "light"; className?: string; title?: string }) {
  const light = variant === "light";
  return (
    <svg
      viewBox={BRAND_MARK.viewBox}
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="48" height="48" rx={BRAND_MARK.radius} fill={light ? "#FFFFFF" : "var(--brand-deep)"} />
      <path d={BRAND_MARK.arc} fill="none" stroke={light ? "var(--brand-deep)" : "#FFFFFF"} strokeWidth={BRAND_MARK.arcWidth} strokeLinecap="round" />
      <circle {...BRAND_MARK.dot} fill="var(--brand-highlight)" />
    </svg>
  );
}

/** Símbolo + nome. Use variant "light" sobre fundos escuros (menu lateral, painel de login). */
export function BrandLogo({ className, variant = "dark" }: { className?: string; variant?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark variant={variant} />
      <span className="text-xl font-black tracking-tight">{BRAND.name}</span>
    </span>
  );
}
