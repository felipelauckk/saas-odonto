/** Iniciais para o avatar: primeira e última palavra, sem "Dr.", "Dra." e sem "da/de/do". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !/^dra?\.?$/i.test(w) && !/^(da|de|do|das|dos|e)$/i.test(w));
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}
