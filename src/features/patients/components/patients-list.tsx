import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronRight as Arrow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ageFromBirthDate } from "@/lib/dates";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";

type Row = {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp: string | null;
  archived_at: string | null;
};

function details(p: Row) {
  const phone = p.phone ?? p.whatsapp;
  return [
    p.birth_date ? `${ageFromBirthDate(p.birth_date)} anos` : null,
    phone ? formatPhone(phone) : null,
    p.cpf ? `CPF ${formatCpfCnpj(p.cpf)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function PatientsList({ patients }: { patients: Row[] }) {
  return (
    <ul className="divide-y rounded-xl border">
      {patients.map((p) => (
        <li key={p.id}>
          <Link
            href={`/pacientes/${p.id}`}
            className="flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 sm:px-5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground" aria-hidden>
              {p.full_name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.full_name}</span>
                {p.archived_at ? <Badge variant="secondary">Arquivado</Badge> : null}
              </span>
              <span className="block truncate text-sm text-muted-foreground">{details(p) || "Sem contato cadastrado"}</span>
            </span>
            <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

type PaginationProps = { page: number; pages: number; total: number; hrefFor: (page: number) => string };

export function Pagination({ page, pages, total, hrefFor }: PaginationProps) {
  if (pages <= 1) return <p className="text-sm text-muted-foreground">{total === 1 ? "1 paciente" : `${total} pacientes`}</p>;
  return (
    <nav aria-label="Páginas" className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        {total} pacientes · página {page} de {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Página anterior">
            <ChevronLeft />
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Próxima página">
            <ChevronRight />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
