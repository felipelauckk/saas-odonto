import { BrandLogo } from "@/components/app/brand-mark";

export function Brand({ variant = "dark" }: { variant?: "dark" | "light" }) {
  return <BrandLogo variant={variant} className="px-2" />;
}
