import { cn } from "cn";

import { conditionColors, toothKind, wholeFills, type ToothCondition } from "../odontogram";

/** Silhuetas (coroa embaixo, raízes em cima no desenho base de 32×44). */
const SILHOUETTES = {
  molar:
    "M5 6 C5 2, 10 2, 12 4 C14 2, 18 2, 20 4 C22 2, 27 2, 27 6 L27 16 C27 19, 26 21, 25 22 L23 38 C22.6 41, 19.5 41, 19.5 38 L18.5 24 L13.5 24 L12.5 38 C12.5 41, 9.4 41, 9 38 L7 22 C6 21, 5 19, 5 16 Z",
  premolar: "M8 6 C8 2, 24 2, 24 6 L24 16 C24 20, 22 22, 21 23 L18.5 40 C18 42.5, 14 42.5, 13.5 40 L11 23 C10 22, 8 20, 8 16 Z",
  canine: "M9 8 C9 4, 13 1, 16 1 C19 1, 23 4, 23 8 L23 16 C23 20, 21 22, 20 23 L17.5 42 C17 44, 15 44, 14.5 42 L12 23 C11 22, 9 20, 9 16 Z",
  incisor: "M10 3 C10 1.5, 22 1.5, 22 3 L22 16 C22 19.5, 20.5 21.5, 19.5 22.5 L17.5 40 C17 42.5, 15 42.5, 14.5 40 L12.5 22.5 C11.5 21.5, 10 19.5, 10 16 Z",
} as const;

/**
 * Desenho anatômico do dente pelo tipo. Na arcada superior as raízes ficam
 * para cima; coroa, implante, canal e ausência mudam o desenho.
 */
export function ToothSilhouette({ tooth, upper, whole }: { tooth: number; upper: boolean; whole: ToothCondition | null }) {
  const missing = whole === "missing";
  const stroke = whole && whole !== "missing" && whole !== "other" ? conditionColors[whole] : "var(--tooth-outline)";
  return (
    <svg viewBox="0 0 32 44" className={cn("h-[2.625rem] w-[1.875rem]", missing && "opacity-60")} aria-hidden>
      <g transform={upper ? "translate(0 44) scale(1 -1)" : undefined}>
        <path
          d={SILHOUETTES[toothKind(tooth)]}
          fill={(whole && wholeFills[whole]) ?? "var(--tooth-surface)"}
          stroke={stroke}
          strokeWidth={1.4}
          strokeDasharray={missing ? "3 3" : undefined}
          strokeLinejoin="round"
        />
        <path d="M7 19 H25" stroke={stroke} strokeWidth={0.8} opacity={0.5} />
        {whole === "root_canal" ? <path d="M16 21 L16 39" stroke={conditionColors.root_canal} strokeWidth={2.2} strokeLinecap="round" /> : null}
        {whole === "implant" ? (
          <path d="M12 22 H20 M12.5 26 H19.5 M13 30 H19 M13.5 34 H18.5 M14 38 H18" stroke={conditionColors.implant} strokeWidth={1.6} strokeLinecap="round" />
        ) : null}
      </g>
      {missing ? <path d="M7 10 L25 34 M25 10 L7 34" stroke="var(--muted-foreground)" strokeWidth={2} strokeLinecap="round" /> : null}
    </svg>
  );
}

/** Posições do círculo de 5 faces numa caixa de 44px (anel externo r=18, centro r=7,5). */
export type WheelSlot = "top" | "right" | "bottom" | "left" | "center";

export const WHEEL_PATHS: Record<WheelSlot, string> = {
  top: "M9.27 9.27 A18 18 0 0 1 34.73 9.27 L27.3 16.7 A7.5 7.5 0 0 0 16.7 16.7 Z",
  right: "M34.73 9.27 A18 18 0 0 1 34.73 34.73 L27.3 27.3 A7.5 7.5 0 0 0 27.3 16.7 Z",
  bottom: "M34.73 34.73 A18 18 0 0 1 9.27 34.73 L16.7 27.3 A7.5 7.5 0 0 0 27.3 27.3 Z",
  left: "M9.27 34.73 A18 18 0 0 1 9.27 9.27 L16.7 16.7 A7.5 7.5 0 0 0 16.7 27.3 Z",
  center: "M14.5 22 A7.5 7.5 0 1 0 29.5 22 A7.5 7.5 0 1 0 14.5 22 Z",
};

/**
 * Botão de cada face: caixa só do tamanho do setor (o centro da caixa cai dentro
 * da face, para o clique e o leitor de tela acertarem) e recorte no sistema da caixa.
 */
export const WHEEL_BUTTONS: Record<WheelSlot, { box: React.CSSProperties; clip: string }> = {
  top: { box: { left: 0, top: 0, width: 44, height: 16.7 }, clip: WHEEL_PATHS.top },
  right: {
    box: { left: 27.3, top: 0, width: 16.7, height: 44 },
    clip: "M7.43 9.27 A18 18 0 0 1 7.43 34.73 L0 27.3 A7.5 7.5 0 0 0 0 16.7 Z",
  },
  bottom: {
    box: { left: 0, top: 27.3, width: 44, height: 16.7 },
    clip: "M34.73 7.43 A18 18 0 0 1 9.27 7.43 L16.7 0 A7.5 7.5 0 0 0 27.3 0 Z",
  },
  left: { box: { left: 0, top: 0, width: 16.7, height: 44 }, clip: WHEEL_PATHS.left },
  center: { box: { left: 14.5, top: 14.5, width: 15, height: 15 }, clip: "M0 7.5 A7.5 7.5 0 1 0 15 7.5 A7.5 7.5 0 1 0 0 7.5 Z" },
};
