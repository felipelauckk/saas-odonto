/** Leitura de extrato OFX (formato SGML ou XML dos bancos brasileiros). */

export type OfxTransaction = { fitid: string; postedOn: string; amountCents: number; description: string };

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  return match ? match[1]!.trim() : null;
}

/** Valor OFX ("-123.45", "123,45", "1.234,56") em centavos. */
export function parseOfxAmount(raw: string): number | null {
  let v = raw.trim().replace(/\s/g, "");
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

export function parseOfx(content: string): { accountLabel: string | null; transactions: OfxTransaction[] } {
  const bank = tag(content, "BANKID");
  const account = tag(content, "ACCTID");
  const accountLabel = [bank, account].filter(Boolean).join(" / ") || null;
  const blocks = content.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]!);
  const transactions: OfxTransaction[] = [];
  for (const block of blocks) {
    const date = tag(block, "DTPOSTED");
    const amount = tag(block, "TRNAMT");
    if (!date || !amount || !/^\d{8}/.test(date)) continue;
    const cents = parseOfxAmount(amount);
    if (cents === null || cents === 0) continue;
    const postedOn = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    const description = [tag(block, "NAME"), tag(block, "MEMO")].filter(Boolean).join(" · ") || "Sem descrição";
    const fitid = tag(block, "FITID") ?? `${postedOn}:${cents}:${description}`;
    transactions.push({ fitid: fitid.slice(0, 120), postedOn, amountCents: cents, description: description.slice(0, 300) });
  }
  return { accountLabel, transactions };
}

export type MatchCandidate = { id: string; kind: "receivable" | "payable" | "cash"; amountCents: number; date: string; label: string };

function daysBetween(a: string, b: string) {
  return Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/**
 * Sugere o par mais provável para uma linha do extrato: mesmo valor (entrada
 * com recebimento, saída com pagamento) e data até 3 dias de diferença; entre
 * vários, o de data mais próxima. Ninguém é sugerido duas vezes.
 */
export function suggestMatches(
  bank: { id: string; amountCents: number; postedOn: string }[],
  candidates: MatchCandidate[],
  maxDays = 3,
): Map<string, MatchCandidate> {
  const used = new Set<string>();
  const result = new Map<string, MatchCandidate>();
  const ordered = [...bank].sort((a, b) => a.postedOn.localeCompare(b.postedOn));
  for (const tx of ordered) {
    const credit = tx.amountCents > 0;
    const best = candidates
      .filter((c) => !used.has(c.id) && (credit ? c.kind === "receivable" || (c.kind === "cash" && c.amountCents > 0) : c.kind === "payable" || (c.kind === "cash" && c.amountCents < 0)))
      .filter((c) => Math.abs(c.amountCents) === Math.abs(tx.amountCents) && daysBetween(c.date, tx.postedOn) <= maxDays)
      .sort((a, b) => daysBetween(a.date, tx.postedOn) - daysBetween(b.date, tx.postedOn))[0];
    if (best) {
      used.add(best.id);
      result.set(tx.id, best);
    }
  }
  return result;
}
