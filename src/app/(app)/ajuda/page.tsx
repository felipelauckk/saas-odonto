import type { Metadata } from "next";
import Link from "next/link";

import { Markdown } from "@/components/app/markdown";
import { PageHeader } from "@/components/layout/page-header";
import { getHelpMarkdown } from "@/features/help/content";

export const metadata: Metadata = { title: "Ajuda" };

export default async function Page() {
  const source = await getHelpMarkdown();
  return (
    <div className="space-y-6">
      <PageHeader title="Ajuda" description="Perguntas frequentes sobre o dia a dia na Arcada." />
      <article className="rounded-card border bg-card p-5 shadow-card sm:p-8">
        {/* O primeiro título do arquivo já é o da página. */}
        <Markdown source={source.replace(/^# .*\n/, "")} />
      </article>
      <p className="text-sm text-muted-foreground">
        Veja também as{" "}
        <Link href="/novidades" className="font-medium text-primary hover:underline">
          novidades
        </Link>{" "}
        do sistema.
      </p>
    </div>
  );
}
