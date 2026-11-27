import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "content");

export type NewsEntry = { slug: string; date: string; version: string; title: string; body: string };

/** Perguntas frequentes (content/ajuda.md). */
export async function getHelpMarkdown(): Promise<string> {
  return readFile(path.join(DIR, "ajuda.md"), "utf8");
}

/** Lê o cabeçalho "--- chave: valor ---" de um arquivo de novidade. */
export function parseNews(slug: string, raw: string): NewsEntry | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const meta = Object.fromEntries(
    match[1]!
      .split("\n")
      .map((line) => line.split(/:(.*)/s).map((s) => s.trim()))
      .filter((p) => p[0]),
  ) as Record<string, string>;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.data ?? "")) return null;
  return { slug, date: meta.data!, version: meta.versao ?? "", title: meta.titulo ?? "Novidades", body: match[2]!.trim() };
}

/** Novidades (content/novidades/*.md), da mais nova para a mais antiga. */
export async function getNews(): Promise<NewsEntry[]> {
  const dir = path.join(DIR, "novidades");
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".md"));
  const entries = await Promise.all(files.map(async (f) => parseNews(f.replace(/\.md$/, ""), await readFile(path.join(dir, f), "utf8"))));
  return entries.filter((e): e is NewsEntry => e !== null).sort((a, b) => b.date.localeCompare(a.date));
}
