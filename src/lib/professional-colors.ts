/**
 * Cores de profissional na agenda: pares forte/suave da paleta Arcada.
 * O profissional escolhe uma delas, não uma cor livre. Cores gravadas antes do
 * redesign são mostradas pela cor da paleta mais próxima (o banco não muda).
 */
export type ProfessionalColor = { value: string; soft: string; label: string };

export const PROFESSIONAL_COLORS: readonly ProfessionalColor[] = [
  { value: "#17707F", soft: "#E3F0F1", label: "Petróleo" },
  { value: "#5B49A8", soft: "#EFECF9", label: "Violeta" },
  { value: "#A3560F", soft: "#FBF0E3", label: "Âmbar" },
  { value: "#2E7D4F", soft: "#EAF5EE", label: "Verde" },
  { value: "#B03A6C", soft: "#FBEEF3", label: "Rosa" },
  { value: "#2F5FB3", soft: "#ECF2FB", label: "Azul" },
];

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Cor da paleta mais próxima (distância RGB com pesos perceptuais). */
export function professionalColor(hex: string | null | undefined): ProfessionalColor {
  const fallback = PROFESSIONAL_COLORS[0]!;
  const c = hex ? rgb(hex) : null;
  if (!c) return fallback;
  let best = fallback;
  let bestD = Infinity;
  for (const p of PROFESSIONAL_COLORS) {
    const [r, g, b] = rgb(p.value)!;
    const rm = (c[0] + r) / 2;
    const d = (2 + rm / 256) * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + (2 + (255 - rm) / 256) * (c[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
