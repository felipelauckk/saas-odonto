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

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-lg font-black tracking-tight">{BRAND.name}</span>
    </span>
  );
}
