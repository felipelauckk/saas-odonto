import "server-only";

import { Text, View } from "@react-pdf/renderer";

import { formatIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { renderReportPdf, type PdfLetterhead } from "@/lib/pdf/report-pdf";
import { PDF_COLORS } from "@/lib/pdf/fonts";
import { itemStatusLabels } from "@/features/plans/labels";

import { ARCHES, conditionLabels, currentState, faceLabel, isUpperTooth, type Face, type ToothCondition, type ToothState } from "./odontogram";

/** Cores das condições (as mesmas do tema claro da tela). */
const COLORS: Record<ToothCondition, string> = {
  healthy: "#ffffff",
  caries: "#d92d20",
  restored: "#17707f",
  missing: "#9aa1ab",
  implant: "#5b49a8",
  crown: "#a3560f",
  root_canal: "#344054",
  other: "#0d9488",
};
const WHOLE_SOFT: Partial<Record<ToothCondition, string>> = { crown: "#fbf0e3", implant: "#efecf9", root_canal: "#f1f2f5", missing: "#eef0f2" };
const OUTLINE = "#b8bec6";

function mesialRight(tooth: number) {
  return [1, 4, 5, 8].includes(Math.floor(tooth / 10));
}

/** Dente no PDF: número e um quadrado com as cinco faces (como na tela). */
function PdfTooth({ tooth, state, size }: { tooth: number; state: ToothState | undefined; size: number }) {
  const upper = isUpperTooth(tooth);
  const whole = state?.whole ?? null;
  const base = (whole && WHOLE_SOFT[whole]) ?? "#ffffff";
  const fill = (f: Face) => (state?.faces[f] ? COLORS[state.faces[f]!] : base);
  const top: Face = upper ? "V" : "L";
  const bottom: Face = upper ? "L" : "V";
  const left: Face = mesialRight(tooth) ? "D" : "M";
  const right: Face = mesialRight(tooth) ? "M" : "D";
  const band = size * 0.28;
  const cell = (style: object, color: string) => <View style={{ position: "absolute", backgroundColor: color, borderColor: OUTLINE, borderWidth: 0.4, ...style }} />;
  const box = (
    <View style={{ width: size, height: size, position: "relative", borderWidth: whole ? 1.2 : 0.6, borderColor: whole ? COLORS[whole] : OUTLINE, borderStyle: whole === "missing" ? "dashed" : "solid" }}>
      {cell({ top: 0, left: 0, right: 0, height: band }, fill(top))}
      {cell({ bottom: 0, left: 0, right: 0, height: band }, fill(bottom))}
      {cell({ top: band, bottom: band, left: 0, width: band }, fill(left))}
      {cell({ top: band, bottom: band, right: 0, width: band }, fill(right))}
      {cell({ top: band, bottom: band, left: band, right: band }, fill("O"))}
    </View>
  );
  const label = <Text style={{ fontSize: size * 0.32, color: PDF_COLORS.muted, textAlign: "center", marginVertical: 1 }}>{tooth}</Text>;
  return (
    <View style={{ alignItems: "center", marginHorizontal: 1.2 }}>
      {upper ? label : box}
      {upper ? box : label}
    </View>
  );
}

function Chart({ state, mixed }: { state: Map<number, ToothState>; mixed: boolean }) {
  const row = (teeth: readonly number[], size: number) => (
    <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 4 }}>
      {teeth.map((t, i) => (
        <View key={t} style={{ marginLeft: i === teeth.length / 2 ? 6 : 0 }}>
          <PdfTooth tooth={t} state={state.get(t)} size={size} />
        </View>
      ))}
    </View>
  );
  const used = [...state.keys()];
  const legend = (Object.keys(COLORS) as ToothCondition[]).filter((c) => c !== "healthy" && used.some((t) => state.get(t)?.whole === c || Object.values(state.get(t)?.faces ?? {}).includes(c)));
  return (
    <View>
      {row(ARCHES.upperPermanent, 22)}
      {mixed ? row(ARCHES.upperDeciduous, 17) : null}
      {mixed ? row(ARCHES.lowerDeciduous, 17) : null}
      {row(ARCHES.lowerPermanent, 22)}
      {legend.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
          {legend.map((c) => (
            <View key={c} style={{ flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 2 }}>
              <View style={{ width: 7, height: 7, backgroundColor: COLORS[c], marginRight: 3 }} />
              <Text style={{ fontSize: 7.5 }}>{conditionLabels[c]}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export type OdontogramPdfItem = {
  date: string | null;
  tooth: number | null;
  faces: string[];
  description: string;
  sessionsPlanned: number;
  sessionsDone: number;
  status: keyof typeof itemStatusLabels;
};

/** Odontograma em PDF: desenho (com decíduos quando houver registro) e os procedimentos do plano. */
export async function renderOdontogramPdf(opts: {
  letterhead: PdfLetterhead;
  patientName: string;
  records: { tooth: number; faces: string[]; condition: ToothCondition }[];
  items: OdontogramPdfItem[];
}): Promise<Buffer> {
  const state = currentState(opts.records);
  const mixed = [...state.keys()].some((t) => t >= 51);
  return renderReportPdf({
    letterhead: opts.letterhead,
    title: "Odontograma",
    subtitle: `${opts.patientName} · ${formatDate(new Date().toISOString())}`,
    blocks: [
      { kind: "custom", node: <Chart state={state} mixed={mixed} /> },
      {
        kind: "table",
        title: "Procedimentos do plano",
        columns: [
          { label: "Data", flex: 0.9 },
          { label: "Dente", flex: 1.4 },
          { label: "Procedimento", flex: 2.2 },
          { label: "Sessões", flex: 0.8 },
          { label: "Situação", flex: 1 },
        ],
        rows: opts.items.map((i) => [
          i.date ? formatIsoDate(i.date) : "",
          i.tooth ? `${i.tooth}${i.faces.length ? ` (${i.faces.map((f) => faceLabel(f as Face, i.tooth!)).join(", ")})` : ""}` : "",
          i.description,
          `${Math.min(i.sessionsDone, i.sessionsPlanned)}/${i.sessionsPlanned}`,
          itemStatusLabels[i.status],
        ]),
        empty: "Nenhum procedimento em plano aprovado.",
      },
    ],
  });
}
