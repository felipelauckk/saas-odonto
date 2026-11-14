"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { PATIENT_TABS } from "../labels";

export function PatientTabs({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const base = `/pacientes/${patientId}`;

  return (
    <nav aria-label="Ficha do paciente" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {PATIENT_TABS.map(({ slug, label }) => {
          const href = slug ? `${base}/${slug}` : base;
          const active = slug ? pathname.startsWith(href) : pathname === base || pathname === `${base}/editar`;
          return (
            <li key={slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
