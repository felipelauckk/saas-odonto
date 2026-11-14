import { TriangleAlert } from "lucide-react";

/** Alertas da anamnese (alergias, doenças) — visível para todos os papéis. */
export function AlertsBanner({ alerts }: { alerts: { label: string | null; details: string | null }[] }) {
  if (!alerts.length) return null;
  return (
    <div
      role="note"
      aria-label="Alertas da anamnese"
      className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-destructive">Atenção na anamnese</p>
        <ul className="space-y-0.5">
          {alerts.map((a, i) => (
            <li key={i}>
              {a.label}
              {a.details ? <strong className="font-medium"> — {a.details}</strong> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
