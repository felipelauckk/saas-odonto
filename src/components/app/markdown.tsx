import { Fragment, type ReactNode } from "react";

/** Negrito (**x**) e links ([texto](url)) dentro de uma linha. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index}>{m[1]}</strong>);
    else {
      const href = m[3]!;
      const safe = href.startsWith("/") || href.startsWith("https://") || href.startsWith("mailto:");
      parts.push(
        safe ? (
          <a key={m.index} href={href} className="font-medium text-primary underline-offset-2 hover:underline">
            {m[2]}
          </a>
        ) : (
          m[2]
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Markdown simples do repositório (ajuda e novidades): títulos #, ## e ###,
 * parágrafos, listas com "-", negrito e links. Sem HTML.
 */
export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.split("\n");
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length} className="text-sm leading-relaxed">{inline(para.join(" "))}</p>);
    if (list.length)
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {list.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>,
      );
    para = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1]!.length;
      const cls = level === 1 ? "type-title" : level === 2 ? "type-section pt-4" : "pt-2 text-[0.9375rem] font-semibold";
      const Tag = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
      blocks.push(
        <Tag key={blocks.length} className={cls}>
          {inline(h[2]!)}
        </Tag>,
      );
    } else if (/^-\s+/.test(line)) {
      if (para.length) flush();
      list.push(line.replace(/^-\s+/, ""));
    } else if (!line.trim()) {
      flush();
    } else {
      if (list.length) flush();
      para.push(line.trim());
    }
  }
  flush();
  return <div className="space-y-3">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
