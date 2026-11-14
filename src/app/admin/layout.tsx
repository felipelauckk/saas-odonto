import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { requirePlatformAdmin } from "@/features/admin/guard";

export const metadata = { title: { default: "Administração", template: "%s · Administração" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePlatformAdmin();
  return (
    <div className="min-h-full">
      <header className="flex h-14 items-center gap-6 border-b px-4 sm:px-8">
        <Brand />
        <nav aria-label="Administração" className="flex gap-4 text-sm">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">Clínicas</Link>
          <Link href="/admin/planos" className="text-muted-foreground hover:text-foreground">Planos</Link>
        </nav>
        <Link href="/painel" className="ml-auto text-sm text-muted-foreground hover:text-foreground">Voltar ao sistema</Link>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
