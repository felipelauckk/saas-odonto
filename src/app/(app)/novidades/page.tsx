import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { Markdown } from "@/components/app/markdown";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { getNews } from "@/features/help/content";
import { MarkNewsSeen } from "@/features/help/mark-news-seen";
import { formatIsoDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Novidades" };

export default async function Page() {
  const news = await getNews();
  return (
    <div className="space-y-6">
      <PageHeader title="Novidades" description="O que mudou na Arcada." />
      {news[0] ? <MarkNewsSeen latest={news[0].date} /> : null}
      {news.length ? (
        <ol className="space-y-4">
          {news.map((n) => (
            <li key={n.slug}>
              <article className="space-y-3 rounded-card border bg-card p-5 shadow-card sm:p-6">
                <header className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {formatIsoDate(n.date)}
                    {n.version ? ` · versão ${n.version}` : ""}
                  </p>
                  <h2 className="type-title">{n.title}</h2>
                </header>
                <Markdown source={n.body} />
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState icon={Sparkles} title="Nenhuma novidade" description="Quando o sistema ganhar algo novo, aparece aqui." />
      )}
    </div>
  );
}
