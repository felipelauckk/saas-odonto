import { BrandLogo } from "@/components/app/brand-mark";

const trustBadges = ["Dados protegidos conforme a LGPD", "Suporte em português", "Sem fidelidade"];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh bg-background">
      <section
        aria-label="Arcada"
        className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-hero px-16 py-14 text-white lg:flex"
      >
        <svg
          aria-hidden
          viewBox="0 0 600 600"
          className="pointer-events-none absolute -right-44 -bottom-56 size-160 opacity-10"
        >
          <path d="M70 560 C70 160, 530 160, 530 560" fill="none" stroke="#FFFFFF" strokeWidth="64" strokeLinecap="round" />
          <circle cx="300" cy="560" r="34" fill="var(--brand-highlight)" />
        </svg>
        <BrandLogo variant="light" className="relative [&>svg]:size-10 [&>span]:text-3xl" />
        <div className="relative flex max-w-xl flex-col gap-5">
          <p className="text-5xl leading-[1.02] font-black tracking-tight text-balance xl:text-6xl">
            Menos papel na recepção. <span className="text-tint-mint">Mais sorrisos</span> na cadeira.
          </p>
          <p className="max-w-md text-base leading-relaxed text-white/80">
            Agenda, prontuário, orçamentos, financeiro e relacionamento com o paciente, num sistema só.
          </p>
        </div>
        <ul className="relative flex flex-wrap gap-x-7 gap-y-2 text-[0.8125rem] text-white/72">
          {trustBadges.map((badge) => (
            <li key={badge}>{badge}</li>
          ))}
        </ul>
      </section>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-12">
        <div className="mb-10 lg:hidden">
          <BrandLogo />
        </div>
        <main className="w-full max-w-sm sm:max-w-[23.75rem]">{children}</main>
      </div>
    </div>
  );
}
